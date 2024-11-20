import browser, { DeclarativeNetRequest } from 'webextension-polyfill';
import { forbiddenUrls, storageStrictModeKey, strictModeBlockPeriod } from "./globals";
import { DeleteAction, DeleteAllAction, GetAllAction, NewRule, ResToSend, RuleInStorage, UpdateAction } from "./types";
import { handleFormSubmission } from './helpers';

/*
Edge cases:
Options page:
  + don't allow adding options page to the list
  + don't allow empty url string
  + adding an existing URL (when one is temporarily disabled)
*/

const urlForm = document.getElementById('url-input-form') as HTMLFormElement;
const errorPara = document.getElementById('extension-error-para') as HTMLParagraphElement;
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tbody = document.getElementById('url-table');
const clearBtn = document.getElementById('clear-btn');
// delete all rules dialog
const clearAllDialog = document.getElementById('clear-all-dialog') as HTMLDialogElement;
const clearDialogOkBtn = document.getElementById('dialog-clear-ok-btn');
const clearDialogCancelBtn = document.getElementById('dialog-clear-cancel-btn');
// delete rule dialog
const deleteDialog = document.getElementById('delete-dialog') as HTMLDialogElement;
const deleteDialogOkBtn = document.getElementById('dialog-delete-ok-btn');
const deleteDialogCancelBtn = document.getElementById('dialog-delete-cancel-btn');
const wrapperElem = document.getElementById('table-wrapper');
const versionElem = document.getElementById('ext-version');
const strictModeSwitch = document.getElementById('strict-mode-switch') as HTMLInputElement;
const webStoreLink = document.getElementById('web-store-link') as HTMLAnchorElement;
const webStores = {
  // chrome: "https://chromewebstore.google.com/category/extensions",
  edge: "https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home?",
  firefox: "https://addons.mozilla.org/en-US/firefox/",
  opera: "https://addons.opera.com/en/extensions/"
};

let isEdited = false;
let showEditInput = false;
let editedRulesIds: Set<number> = new Set();
let idToDelete: number | null;
let isLoading = false;
const rowIdPrefix = 'row-';
// let isStrictModeOn = false;

document.addEventListener('DOMContentLoaded', () => {
  displayUrlList();
  saveBtn?.setAttribute('disabled', '');
  cancelBtn?.setAttribute('disabled', '');
  syncStrictMode();
  if (versionElem) {
    versionElem.innerText = getExtVersion() ?? '';
  }
  if (webStoreLink) {
    assignStoreLink();
  }
});

cancelBtn?.addEventListener('click', () => {
  editedRulesIds.clear();
  toggleEditMode(false);
  displayUrlList();
  syncStrictMode();
});

saveBtn?.addEventListener('click', async () => {
  await saveChanges();
});

// Clear All Rules dialog
clearBtn?.addEventListener('click', () => {
  clearAllDialog.showModal();
});

clearDialogCancelBtn?.addEventListener('click', () => {
  clearAllDialog.close();
});

clearDialogOkBtn?.addEventListener('click', async () => {
  await deleteRules();
  clearAllDialog.close();
  editedRulesIds.clear();
  toggleEditMode(false);
  await displayUrlList();
  syncStrictMode();
});

// Delete rule dialog
deleteDialogOkBtn?.addEventListener('click', () => {
  if (idToDelete) {
    deleteRule(idToDelete);
    deleteDialog.close();
  }
});

deleteDialogCancelBtn?.addEventListener('click', () => {
  deleteDialog.close();
});

strictModeSwitch?.addEventListener('change', () => {
  const isStrictModeOn = strictModeSwitch.checked;
  browser.storage.local.set({ strictMode: isStrictModeOn });
  handleInactiveRules(isStrictModeOn);
});

urlForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await handleFormSubmission(urlForm, errorPara, handleSuccessfulFormSubmission);
  await displayUrlList();
  editedRulesIds.clear();
  toggleEditMode(false);
});

function handleSuccessfulFormSubmission() {
  errorPara.textContent = '';
}

async function handleInactiveRules(isStrictModeOn: boolean) {
  if (!isStrictModeOn) {
    browser.storage.local.set({ inactiveRules: [] });
  } else {
    const msg: GetAllAction = { action: 'getRules' };
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    try {
      if (res.success && res.rules) {
        const inactiveRulesToStore: RuleInStorage[] = [];
        const date = new Date();
        const unblockDate = new Date(date.getTime() + strictModeBlockPeriod).getTime();
        res.rules.forEach(rule => {
          const urlToBlock = `^https?:\/\/${rule.strippedUrl}${rule.blockDomain ? '.*' : '$'}`;
          inactiveRulesToStore.push({ id: rule.id, unblockDate: unblockDate, urlToBlock })
        });
        browser.storage.local.set({ inactiveRules: inactiveRulesToStore });
      }
    } catch (error) {
      console.error(error);
    }
  }
}

function toggleEditMode(bool: boolean) {
  isEdited = bool;
  if (isEdited) {
    saveBtn?.removeAttribute('disabled');
    cancelBtn?.removeAttribute('disabled');
  } else {
    saveBtn?.setAttribute('disabled', '');
    cancelBtn?.setAttribute('disabled', '');
  }
}

async function displayUrlList() {
  isLoading = true;
  displayLoader();
  const msg: GetAllAction = { action: 'getRules' };
  const res: ResToSend = await browser.runtime.sendMessage(msg);
  try {
    if (res.success && wrapperElem) {
      if (res.rules) {
        showEditInput = false;
        wrapperElem.innerHTML = '';
        if (res.rules.length === 0) {
          const noRulesElem = document.createElement('h3');
          noRulesElem.innerText = 'No URLs to block.';
          wrapperElem.appendChild(noRulesElem); 
        } else {
          const urlList = res.rules.sort((a, b) => a.strippedUrl.localeCompare(b.strippedUrl));
          const urlTable = document.createElement('table');
          urlTable.classList.add("blacklist-table", "table");
          urlTable.innerHTML = `
            <thead>
              <th>No.</th>
              <th>URL</th>
              <th class="domain-th">
                Block subdomains
              </th>
              <th></th>
              <th></th>
              <th>Active</th>
            </thead>
            <tbody id="url-table">
            </tbody>
          `;
          wrapperElem.appendChild(urlTable);
          const tbody = document.getElementById('url-table');
          tbody && urlList.map((rule, i) => {
            const ruleElem = document.createElement('tr');
            ruleElem.id = `${rowIdPrefix}${rule.id}`;
            ruleElem.classList.add('row');
            !rule.isActive && ruleElem.classList.add('inactive-url');
            const content = `
              <td>${i + 1}</td>
              <!-- <td class="row-id">${rule.id}</td> -->
              <td class="row-url">${rule.strippedUrl}</td>
              <!-- <td>${rule.url}</td> -->
              <td class="row-domain">
                <input 
                  class="domain-checkbox"
                  name="domain"
                  type="checkbox"
                  ${rule.blockDomain && 'checked'}
                />
              </td>
              <td>
                <button class="edit-rule-btn" ${showEditInput ? 'disabled' : ''}
                >
                  <img src="./icons/edit.svg" alt="edit URL button">
                </button>
              </td>
              <td>
                <button class="delete-rule-btn" ${showEditInput ? 'disabled' : ''}
                >
                  <img src="./icons/delete.svg" alt="delete URL button">
                </button>
              </td>
              <td>
                <label class="active-switch">
                  <input 
                    type="checkbox"
                    class="active-checkbox ${!rule.isActive ? 'inactive-url' : ''}"
                    name="active"
                    ${rule.isActive && 'checked'}
                  />
                  <span class="active-slider round"></span>
                </label>
              </td>
            `;
            ruleElem.innerHTML = content;
            tbody.appendChild(ruleElem);
  
            const updateRuleRow = document.getElementById(`row-${rule.id}`);
            const editBtn = updateRuleRow?.querySelector('.edit-rule-btn');
            if (editBtn) {
              editBtn.addEventListener('click', () => {
                if (!showEditInput) {
                  showEditInput = true;
                  editedRulesIds.add(rule.id);
                  disableOtherBtns(rule.id);
                  toggleEditMode(true);
                  const urlCell = updateRuleRow?.querySelector('.row-url');
                  if (urlCell) {
                    urlCell.innerHTML = `
                      <input
                        name="url"
                        type="text"
                        value=${rule.strippedUrl}
                        required
                      />
                    `;
                  }
                }
              })
            }
  
            const deleteBtn = updateRuleRow?.querySelector('.delete-rule-btn');
            if (deleteBtn) {
              deleteBtn.addEventListener('click', () => {
                idToDelete = rule.id;
                deleteDialog.showModal();
              });
            }
  
            const domainToggle = updateRuleRow?.querySelector('.domain-checkbox');
            domainToggle?.addEventListener('change', () => {
              toggleEditMode(true);
              editedRulesIds.add(rule.id);
            });
  
            const activeToggle = updateRuleRow?.querySelector('.active-checkbox');
            activeToggle?.addEventListener('change', () => {
              updateRuleRow?.classList.toggle('inactive-url');
              toggleEditMode(true);
              editedRulesIds.add(rule.id);
            });
          });
        }
      }
    }
  } catch (error) {
    console.error(error);
    alert('An error occured. Check the console.');
  } finally {
    isLoading = false;
  }
}

function displayLoader() {
  if (wrapperElem) {
    const loader = document.createElement('div');
    loader.classList.add('loader');
    wrapperElem.innerHTML = '';
    wrapperElem.appendChild(loader);
  }
}

async function deleteRule(id: number) {
  const msg: DeleteAction = { action: "deleteRule", deleteRuleId: id };
  const res: ResToSend = await browser.runtime.sendMessage(msg);
  try {
    if (res.success) {
      editedRulesIds.delete(id);
      displayUrlList();
      syncStrictMode();
      idToDelete = null;
    }
  } catch (error) {
    console.error(res.error);
    alert('Error: Could not delete the rule')
  }
}

async function deleteRules() {
  const msg: DeleteAllAction = { action: 'deleteAll' };
  try {
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    if (res.success) {
      console.log('All rules have been deleted');
    }
  } catch (error) {
    alert('An error occured. Check the console.');
    console.error(error);
  }
}

async function saveChanges() {
  let updatedRules: NewRule[] = [];

  if (editedRulesIds.size === 0) {
    toggleEditMode(false);
    displayUrlList();
    syncStrictMode();
    alert('No changes were made');
    return;
  }

  const rulesToStore: RuleInStorage[] = [];
  const strictModeOn = await browser.storage.local.get([storageStrictModeKey]);
  const date = new Date();
  const unblockDate = new Date(date.getTime() + strictModeBlockPeriod).getTime();
  for (const elem of editedRulesIds) {
    const editedRow = document.getElementById(`row-${elem}`);
    if (editedRow) {
      const rowId = Number(editedRow.id.substring(rowIdPrefix.length)); // e.g. "row-1"
      const urlInput = editedRow.querySelector('.row-url > input') as HTMLInputElement;
      let strippedUrl = urlInput ? urlInput.value : editedRow.querySelector('.row-url')?.textContent;
      strippedUrl = strippedUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const blockDomain = (editedRow.querySelector('.domain-checkbox') as HTMLInputElement)?.checked;
      const urlToBlock = `^https?:\/\/${strippedUrl}${blockDomain ? '\/?.*' : '\/?$'}`;
      const isActive = (editedRow.querySelector('.active-checkbox') as HTMLInputElement)?.checked;

      if (!strippedUrl || forbiddenUrls.some(url => url.test(strippedUrl))) {
        alert('Invalid URL');
        editedRulesIds.clear();
        toggleEditMode(false);
        displayUrlList();
        syncStrictMode();
        console.error(`Invalid URL: ${urlToBlock}`);
        return;
      }

      const updatedRule: NewRule = {
        id: rowId,
        priority: 1,
        action: {
          type: isActive
            ? 'redirect'
            : 'allow',
          ...(isActive && {
            redirect: {
              regexSubstitution: browser.runtime.getURL("blocked.html")
            }
          })
        },
        condition: {
          regexFilter: urlToBlock,
          resourceTypes: ["main_frame" as DeclarativeNetRequest.ResourceType]
        }
      };
      updatedRules.push(updatedRule);
      strictModeOn && !isActive && rulesToStore.push({ id: rowId, unblockDate, urlToBlock });
    }
  }

  const msg: UpdateAction = { action: 'updateRules', updatedRules };
  const res: ResToSend = await browser.runtime.sendMessage(msg);
  try {
    if (res.success && res.rules) {
      isEdited = false;
      browser.storage.local.set({ inactiveRules: rulesToStore });
      editedRulesIds.clear();
      displayUrlList();
      toggleEditMode(false);
      alert('Changes have been saved');
    }
  } catch (error) {
    console.error(res.error);
    alert('Could not save changes. Check the console.');
  }
}

function disableOtherBtns(ruleId: number) {
  const allRows = tbody?.querySelectorAll('.row');

  allRows?.forEach(r => {
    if (r.id !== `row-${ruleId}`) {
      const editBtn = r.querySelector('.edit-rule-btn');
      if (editBtn) {
        editBtn.setAttribute('disabled', '');
      }
      const deleteBtn = r?.querySelector('.delete-rule-btn');
      if (deleteBtn) {
        deleteBtn.setAttribute('disabled', '');
      }
    }
  });
}

async function syncStrictMode() {
  try {
    const result = await browser.storage.local.get(storageStrictModeKey);
    if (storageStrictModeKey in result) {
      const strictMode = result[storageStrictModeKey];
      if (typeof strictMode === 'boolean') {
        strictModeSwitch.checked = strictMode;
      } else {
        console.warn('strictMode is not a boolean');
      }
    } else {
      console.warn('strictMode key doesn\'t exist');
    }
  } catch (error) {
    console.error(error);
  }
}

function getExtVersion() {
  const v = browser.runtime.getManifest().version;
  return v;
}

/*
Brave:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
Chrome:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
Opera:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0'
Firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
Edge:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
*/

function assignStoreLink() {
  const browser = navigator.userAgent;
  if (browser.includes('OPR/')) {
    webStoreLink.href = webStores.opera;
  } else if (browser.includes('Firefox/')) {
    webStoreLink.href = webStores.firefox;
  } else if (browser.includes('Edg/')) {
    webStoreLink.href = webStores.edge;
  }
}
