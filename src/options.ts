import browser, { DeclarativeNetRequest } from 'webextension-polyfill';
import { forbiddenUrls, storageStrictModeKey, strictModeBlockPeriod, webStores } from "./globals";
import { DeleteAction, DeleteAllAction, GetAllAction, NewRule, ResToSend, RuleInStorage, UpdateAction } from "./types";
import { assignStoreLink, getExtVersion, handleFormSubmission } from './helpers';

/*
Edge cases:
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

let isEdited = false;
let showEditInput = false;
let editedRulesIds: Set<number> = new Set();
let idToDelete: number | null;
const rowIdPrefix = 'row-';

document.addEventListener('DOMContentLoaded', () => {
  displayUrlList();
  saveBtn?.setAttribute('disabled', '');
  cancelBtn?.setAttribute('disabled', '');
  syncStrictMode();
  if (versionElem) {
    versionElem.innerText = getExtVersion() ?? '';
  }
  if (webStoreLink) {
    assignStoreLink(webStoreLink);
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

            const noCell = document.createElement('td');
            noCell.textContent = `${i + 1}`;

            const urlCell = document.createElement('td');
            urlCell.classList.add('row-url');
            urlCell.textContent = `${rule.strippedUrl}`;

            const domainCell = document.createElement('td');
            domainCell.classList.add('row-domain');
            const domainCheckbox = document.createElement('input');
            domainCheckbox.classList.add('domain-checkbox');
            domainCheckbox.name = 'domain';
            domainCheckbox.type = 'checkbox';
            if (rule.blockDomain) {
              domainCheckbox.checked = true;
            }
            domainCell.appendChild(domainCheckbox);

            const editCell = document.createElement('td');
            const editBtn = document.createElement('button');
            editBtn.classList.add('edit-rule-btn');
            if (showEditInput) {
              editBtn.disabled = true;
            }
            editBtn.title = 'edit URL button';

            const editIcon = document.createElement('img');
            editIcon.src = './icons/edit.svg';
            editIcon.alt = 'edit URL button';
            editBtn.appendChild(editIcon);
            editCell.appendChild(editBtn);

            const deleteCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-rule-btn');
            if (showEditInput) {
              deleteBtn.disabled = true;
            }
            deleteBtn.title = 'delete URL button';

            const deleteIcon = document.createElement('img');
            deleteIcon.src = './icons/delete.svg';
            deleteIcon.alt = 'delete URL button';
            deleteBtn.appendChild(deleteIcon);
            deleteCell.appendChild(deleteBtn);

            const activeCell = document.createElement('td');
            const activeLabel = document.createElement('label');
            activeLabel.classList.add('active-switch');

            const activeCheckbox = document.createElement('input');
            activeCheckbox.type = 'checkbox';
            activeCheckbox.classList.add('active-checkbox');
            if (!rule.isActive) {
              activeCheckbox.classList.add('inactive-url');
            }
            activeCheckbox.name = 'active';
            if (rule.isActive) {
              activeCheckbox.checked = true;
            }

            const activeSlider = document.createElement('span');
            activeSlider.classList.add('active-slider', 'round');

            activeLabel.appendChild(activeCheckbox);
            activeLabel.appendChild(activeSlider);
            activeCell.appendChild(activeLabel);

            ruleElem.appendChild(noCell);
            ruleElem.appendChild(urlCell);
            ruleElem.appendChild(domainCell);
            ruleElem.appendChild(editCell);
            ruleElem.appendChild(deleteCell);
            ruleElem.appendChild(activeCell);

            tbody.appendChild(ruleElem);

            const updateRuleRow = document.getElementById(`row-${rule.id}`);
            if (editBtn) {
              editBtn.addEventListener('click', () => {
                if (!showEditInput) {
                  showEditInput = true;
                  editedRulesIds.add(rule.id);
                  disableOtherBtns(rule.id);
                  toggleEditMode(true);
                  const urlCell = updateRuleRow?.querySelector('.row-url');
                  if (urlCell) {
                    urlCell.textContent = '';
                    const editInput = document.createElement('input');
                    editInput.name = 'url';
                    editInput.type = 'text';
                    editInput.value = rule.strippedUrl;
                    editInput.required = true;
                    urlCell.appendChild(editInput);
                  }
                }
              })
            }

            if (deleteBtn) {
              deleteBtn.addEventListener('click', () => {
                idToDelete = rule.id;
                deleteDialog.showModal();
              });
            }

            domainCheckbox?.addEventListener('change', () => {
              toggleEditMode(true);
              editedRulesIds.add(rule.id);
            });

            activeCheckbox.addEventListener('change', () => {
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
    const noRulesElem = document.createElement('h3');
    noRulesElem.classList.add('error-heading');
    noRulesElem.innerText = 'Something went wrong. Please restart the extension.';
    wrapperElem?.appendChild(noRulesElem);
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
    alert('Could not delete the URL.')
  }
}

async function deleteRules() {
  const msg: DeleteAllAction = { action: 'deleteAll' };
  try {
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    if (res.success) {
      // console.log('All rules have been deleted');
    }
  } catch (error) {
    console.error(error);
    alert('Could not delete the URLs.');
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
              regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${rowId}`
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
    alert('Could not save changes.');
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
