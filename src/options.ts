import browser, { DeclarativeNetRequest, search } from 'webextension-polyfill';
import { defaultDisableLimit, forbiddenUrls, storageStrictModeKey, strictModeBlockPeriod } from "./globals";
import { DeleteAction, GetAllAction, NewRule, ResToSend, RuleInStorage, Site, UpdateAction } from "./types";
import { assignStoreLink, checkLastLimitReset, deleteRules, disableOtherBtns, displayLoader, getExtVersion, getUrlToBlock, handleFormSubmission, handleInactiveRules } from './helpers';

/*
Edge cases:
  + don't allow adding options page to the list
  + don't allow empty url string
  + adding an existing URL (when one is temporarily disabled)
*/

const urlForm = document.getElementById('url-input-form') as HTMLFormElement;
const urlInput = document.getElementById('url-input') as HTMLInputElement;
const errorPara = document.getElementById('extension-error-para') as HTMLParagraphElement;
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tbody = document.getElementById('url-table') as HTMLTableSectionElement;
const clearBtn = document.getElementById('clear-btn');
// delete all rules dialog
const clearAllDialog = document.getElementById('clear-all-dialog') as HTMLDialogElement;
const clearDialogOkBtn = document.getElementById('dialog-clear-ok-btn');
const clearDialogCancelBtn = document.getElementById('dialog-clear-cancel-btn');
// delete rule dialog
const deleteDialog = document.getElementById('delete-dialog') as HTMLDialogElement;
const deleteDialogOkBtn = document.getElementById('dialog-delete-ok-btn');
const deleteDialogCancelBtn = document.getElementById('dialog-delete-cancel-btn');
const wrapperElem = document.getElementById('table-wrapper') as HTMLDivElement;
const versionElem = document.getElementById('ext-version');
const strictModeSwitch = document.getElementById('strict-mode-switch') as HTMLInputElement;
const webStoreLink = document.getElementById('web-store-link') as HTMLAnchorElement;
const searchBar = document.getElementById('search-bar') as HTMLInputElement;
const searchClearBtn = document.getElementById('search-input-clear-btn') as HTMLButtonElement;
const limitPara = document.querySelector('.limit-para') as HTMLParagraphElement;
const limitSpan = document.getElementById('disable-limit') as HTMLSpanElement;

let isEdited = false;
let showEditInput = false;
let editedRulesIds: Set<number> = new Set();
let idToDelete: number | null;
let cachedRules: Site[] = [];
let disableAttemptsLeft = defaultDisableLimit;
let currEditDisableCount = 0;
const rowIdPrefix = 'row-';

document.addEventListener('DOMContentLoaded', async () => {
  await displayUrlList();
  saveBtn?.setAttribute('disabled', '');
  cancelBtn?.setAttribute('disabled', '');
  await syncStrictMode();
  await checkLastLimitReset();

  const storedLimitRes = await browser.storage.local.get(['disableLimit']);
  if (!storedLimitRes.disableLimit && storedLimitRes.disableLimit !== 0) {
    browser.storage.local.set({ disableLimit: defaultDisableLimit });
  }
  disableAttemptsLeft = storedLimitRes.disableLimit as number ?? defaultDisableLimit;
  if (strictModeSwitch.checked) {
    limitPara?.classList.remove('hide-limit-para');
    limitSpan.textContent = `${disableAttemptsLeft}`;
  } else {
    limitPara?.classList.add('hide-limit-para')
  }

  if (versionElem) {
    versionElem.innerText = getExtVersion() ?? '';
  }
  if (webStoreLink) {
    assignStoreLink(webStoreLink);
  }
});

cancelBtn?.addEventListener('click', async () => {
  searchBar.value = '';
  editedRulesIds.clear();
  toggleEditMode(false);
  currEditDisableCount = 0;
  await displayUrlList();
  await syncStrictMode();
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
  currEditDisableCount = 0;
  await displayUrlList();
  await syncStrictMode();
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
  if (isStrictModeOn) {
    limitPara?.classList.remove('hide-limit-para');
    limitSpan.textContent = `${disableAttemptsLeft}`;
  } else {
    limitPara?.classList.add('hide-limit-para');
  }
});

urlForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await handleFormSubmission(urlForm, errorPara, handleSuccessfulFormSubmission);
  await displayUrlList();
  editedRulesIds.clear();
  toggleEditMode(false);
  currEditDisableCount = 0;
});

function handleSuccessfulFormSubmission() {
  errorPara.textContent = '';
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
  displayLoader(wrapperElem);
  const msg: GetAllAction = { action: 'getRules' };
  const res: ResToSend = await browser.runtime.sendMessage(msg);

  try {
    if (res.success && wrapperElem) {
      if (res.rules) {
        cachedRules = res.rules;
        populateList(cachedRules);
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

function populateList(rules: Site[]) {
  showEditInput = false;
  wrapperElem!.innerHTML = '';
  if (rules.length === 0) {
    const noRulesElem = document.createElement('h3');
    noRulesElem.innerText = 'No URLs to block.';
    wrapperElem!.appendChild(noRulesElem);
  } else {
    const urlList = rules.sort((a, b) => a.strippedUrl.localeCompare(b.strippedUrl));
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
    wrapperElem!.appendChild(urlTable);
    const tbody = document.getElementById('url-table') as HTMLTableSectionElement;
    tbody && urlList.map((rule, i) => populateTableRows(rule, i, tbody));
  }
}

function populateTableRows(rule: Site, i: number, tbody: HTMLTableSectionElement) {
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
  domainCheckbox.ariaLabel = 'domain';
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
        handleEditBtnClick(rule.id, rule.strippedUrl, updateRuleRow);
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

  activeCheckbox.addEventListener('click', (e) => {
    handleActiveCheckboxClick(activeCheckbox.checked, updateRuleRow, rule.id, e);
  });
}

function handleEditBtnClick(ruleId: number, ruleUrl: string, updateRuleRow: HTMLElement | null) {
  showEditInput = true;
  editedRulesIds.add(ruleId);
  disableOtherBtns(tbody, ruleId);
  toggleEditMode(true);
  const urlCell = updateRuleRow?.querySelector('.row-url');
  if (urlCell) {
    urlCell.textContent = '';
    const editInput = document.createElement('input');
    editInput.name = 'url';
    editInput.type = 'text';
    editInput.value = ruleUrl;
    editInput.required = true;
    urlCell.appendChild(editInput);
  }
}

function handleActiveCheckboxClick(activeCheckboxChecked: boolean, updateRuleRow: HTMLElement | null, ruleId: number, e: MouseEvent) {
  if (strictModeSwitch.checked) {

    // enable rule
    if (activeCheckboxChecked) {
      updateRuleRow?.classList.toggle('inactive-url');
      toggleEditMode(true);
      editedRulesIds.add(ruleId);
    } else {
      // disable rule
      if (currEditDisableCount < disableAttemptsLeft) {
        currEditDisableCount++;
        updateRuleRow?.classList.toggle('inactive-url');
        toggleEditMode(true);
        editedRulesIds.add(ruleId);
      } else {
        e.preventDefault();
        alert('You\'ve exceeded the daily limit for rule disabling!');
      }
    }
  } else {
    updateRuleRow?.classList.toggle('inactive-url');
    toggleEditMode(true);
    editedRulesIds.add(ruleId);
  }
}

async function deleteRule(id: number) {
  const msg: DeleteAction = { action: "deleteRule", deleteRuleId: id };
  const res: ResToSend = await browser.runtime.sendMessage(msg);
  try {
    if (res.success) {
      editedRulesIds.delete(id);
      await displayUrlList();
      await syncStrictMode();
      idToDelete = null;
    }
  } catch (error) {
    console.error(res.error);
    alert('Could not delete the URL.')
  }
}

async function saveChanges() {
  let updatedRules: NewRule[] = [];

  if (editedRulesIds.size === 0) {
    toggleEditMode(false);
    await displayUrlList();
    await syncStrictMode();
    currEditDisableCount = 0;
    alert('No changes were made');
    return;
  }

  const rulesToStore: RuleInStorage[] = [];
  const strictModeOnStorage = await browser.storage.local.get([storageStrictModeKey]);
  const strictModeOn = strictModeOnStorage[storageStrictModeKey] as boolean;
  const storedDisableLimit = await browser.storage.local.get('disableLimit');
  const limitVal = storedDisableLimit.disableLimit as number;
  let disabledRules = 0;
  const date = new Date();
  const unblockDate = new Date(date.getTime() + strictModeBlockPeriod).getTime();
  for (const elem of editedRulesIds) {
    const editedRow = document.getElementById(`row-${elem}`);
    if (editedRow) {
      const rowId = Number(editedRow.id.substring(rowIdPrefix.length)); // e.g. "row-1"
      const urlInput = editedRow.querySelector('.row-url > input') as HTMLInputElement;
      let strippedUrl = urlInput ? urlInput.value : editedRow.querySelector('.row-url')?.textContent ?? '';
      strippedUrl = strippedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const blockDomain = (editedRow.querySelector('.domain-checkbox') as HTMLInputElement)?.checked;
      const urlToBlock = getUrlToBlock(strippedUrl, blockDomain);
      const isActive = (editedRow.querySelector('.active-checkbox') as HTMLInputElement)?.checked;

      if (!strippedUrl || forbiddenUrls.some(url => url.test(strippedUrl))) {
        alert('Invalid URL');
        editedRulesIds.clear();
        toggleEditMode(false);
        currEditDisableCount = 0;
        await displayUrlList();
        await syncStrictMode();
        console.error(`Invalid URL: ${urlToBlock}`);
        return;
      }

      if (!isActive) {
        if (disabledRules < defaultDisableLimit) {
          disabledRules++;
        }
      }

      const updatedRule: NewRule = {
        id: rowId,
        priority: 1,
        action: {
          type: 'allow'
        },
        condition: {
          regexFilter: urlToBlock,
          resourceTypes: ["main_frame" as DeclarativeNetRequest.ResourceType]
        }
      };

      if (strictModeOn) {
        if (isActive || ((limitVal - disabledRules) < 0)) {
          updatedRule.action.type = 'redirect';
          updatedRule.action.redirect = {
            regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${rowId}`
          };
        } else {
          updatedRule.action.type = 'allow';
        }
      } else {
        updatedRule.action.type = isActive ? 'redirect' : 'allow';
        if (isActive) {
          updatedRule.action.redirect = {
            regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${rowId}`
          }
        }
      }

      updatedRules.push(updatedRule);
      strictModeOn && !isActive && rulesToStore.push({ id: rowId, unblockDate, urlToBlock });
    }
  }

  const msg: UpdateAction = { action: 'updateRules', updatedRules };
  const res: ResToSend = await browser.runtime.sendMessage(msg);
  const updatedLimit = limitVal - disabledRules;
  submitChanges(res, rulesToStore, updatedLimit, strictModeOn);
}

async function submitChanges(res: ResToSend, rulesToStore: RuleInStorage[], updatedLimit: number, strictModeOn: boolean) {
  try {
    if (res.success && res.rules) {
      isEdited = false;
      if (strictModeOn) {
        await browser.storage.local.set({ inactiveRules: rulesToStore });
        await browser.storage.local.set({ disableLimit: updatedLimit });
        disableAttemptsLeft = updatedLimit;
        limitSpan.textContent = `${updatedLimit}`;
      }
      editedRulesIds.clear();
      cachedRules = res.rules;
      await displayUrlList();
      toggleEditMode(false);
      currEditDisableCount = 0;
      alert('Changes have been saved');
    }
  } catch (error) {
    console.error(res.error);
    alert('Could not save changes.');
  }
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

searchBar.addEventListener('input', async (e) => {
  toggleEditMode(false);
  currEditDisableCount = 0;
  const target = e.target as HTMLInputElement;

  displayLoader(wrapperElem);
  if (wrapperElem) {
    const queryResults = cachedRules.filter(rule => rule.strippedUrl.includes(target.value));
    populateList(queryResults);
  }
});

searchClearBtn.addEventListener('click', () => {
  if (searchBar && !searchBar.value) {
    searchBar.value = '';
    toggleEditMode(false);
    currEditDisableCount = 0;
    displayLoader(wrapperElem);
    populateList(cachedRules);
  }
});
