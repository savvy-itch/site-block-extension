import { forbiddenUrls, storageKey, storageStrictModeKey, strictModeBlockPeriod } from "./globals";
import { deleteRules } from "./helpers";
import { DeleteAction, GetAllAction, NewRule, ResToSend, RuleInStorage, Site, UpdateAction } from "./types";

/*
Edge cases:
Options page:
  + don't allow adding options page to the list
  + don't allow empty url string
  + adding an existing URL (when one is temporarily disabled)
*/

const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tbody = document.getElementById('url-table');
const clearBtn = document.getElementById('clear-btn');
const strictModeSwitch = document.getElementById('strict-mode-switch') as HTMLInputElement;

let isEdited = false;
let showEditInput = false;
let editedRulesIds: Set<number> = new Set();
// let isStrictModeOn = false;

document.addEventListener('DOMContentLoaded', () => {
  displayUrlList();
  saveBtn?.setAttribute('disabled', '');
  cancelBtn?.setAttribute('disabled', '');
  syncStrictMode();
});

cancelBtn?.addEventListener('click', () => {
  editedRulesIds.clear();
  toggleEditMode(false);
  displayUrlList();
  syncStrictMode();
});

saveBtn?.addEventListener('click', async () => {
  console.log('before saving changes', editedRulesIds);
  await saveChanges();
  // console.log('after saving changes', editedRulesIds);
  // editedRulesIds.clear();
});

clearBtn?.addEventListener('click', () => {
  deleteRules();
  editedRulesIds.clear();
  toggleEditMode(false);
  displayUrlList();
  syncStrictMode();
});

strictModeSwitch?.addEventListener('change', () => {
  console.log(`change event triggered: ${strictModeSwitch.checked}`);
  const isStrictModeOn = strictModeSwitch.checked;
  chrome.storage.local.set({ strictMode: isStrictModeOn });
  handleInactiveRules(isStrictModeOn);
});

function handleInactiveRules(isStrictModeOn: boolean) {
  if (!isStrictModeOn) {
    chrome.storage.local.set({ inactiveRules: [] });
  } else {
    const msg: GetAllAction = { action: 'getRules' };
    chrome.runtime.sendMessage(msg, (res: ResToSend) => {
      if (res.success && res.rules) {
        const inactiveRulesToStore: RuleInStorage[] = [];
        const date = new Date();
        const unblockDate = new Date(date.getTime() + strictModeBlockPeriod).getTime();
        res.rules.forEach(rule => {
          const urlToBlock = `^https?:\/\/${rule.strippedUrl}${rule.blockDomain ? '.*' : '$'}`;
          inactiveRulesToStore.push({ id: rule.id, unblockDate: unblockDate, urlToBlock })
        });
        chrome.storage.local.set({ inactiveRules: inactiveRulesToStore });
      }
    })
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

function displayUrlList() {
  const msg: GetAllAction = { action: 'getRules' };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      if (res.rules) {
        // console.log(res.rules);
        showEditInput = false;
        tbody!.innerHTML = '';
        const urlList = res.rules.sort((a, b) => a.strippedUrl.localeCompare(b.strippedUrl));
        urlList.map((rule, i) => {
          const ruleElem = document.createElement('tr');
          ruleElem.id = `row-${rule.id}`;
          ruleElem.classList.add('row');
          !rule.isActive && ruleElem.classList.add('inactive-url');
          const content = `
            <td>${i + 1}</td>
            <td class="row-id">${rule.id}</td>
            <td class="row-url">${rule.strippedUrl}</td>
            <td>${rule.url}</td>
            <td class="row-domain">
              <input 
                class="domain-checkbox"
                name="domain"
                type="checkbox"
                ${rule.blockDomain && 'checked'}
              />
            </td>
            <td>
              <button class="edit-rule-btn" ${showEditInput ? 'disabled' : ''}>Edit</button>
            </td>
            <td>
              <button class="delete-rule-btn" ${showEditInput ? 'disabled' : ''}>Delete</button>
            </td>
            <td>
              <input 
                class="active-checkbox ${!rule.isActive ? 'inactive-url' : ''}"
                name="active"
                type="checkbox"
                ${rule.isActive && 'checked'}
              />
            </td>
          `;
          ruleElem.innerHTML = content;
          tbody!.appendChild(ruleElem);

          const updateRuleRow = document.getElementById(`row-${rule.id}`);
          const editBtn = updateRuleRow?.querySelector('.edit-rule-btn');
          if (editBtn) {
            editBtn.addEventListener('click', () => {
              if (!showEditInput) {
                showEditInput = true;
                editedRulesIds.add(rule.id)
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
              deleteRule(rule.id);
            });
          }

          const domainToggle = updateRuleRow?.querySelector('.domain-checkbox');
          domainToggle?.addEventListener('change', () => {
            console.log('domain checkbox toggled');
            toggleEditMode(true);
            editedRulesIds.add(rule.id);
          });

          const activeToggle = updateRuleRow?.querySelector('.active-checkbox');
          activeToggle?.addEventListener('change', () => {
            updateRuleRow?.classList.toggle('inactive-url');
            toggleEditMode(true);
            editedRulesIds.add(rule.id);
            // console.log(`active checkbox toggled`, editedRulesIds);
          });
        });
      }
    } else {
      alert('An error occured. Check the console.');
      console.error(res.error);
    }
  })
}

function deleteRule(id: number) {
  console.log(`Called deleteRule for ID: ${id}`);
  const msg: DeleteAction = { action: "deleteRule", deleteRuleId: id };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      editedRulesIds.delete(id);
      displayUrlList();
      syncStrictMode();
    } else {
      alert('Error: Could not delete the rule')
      console.error(res.error);
    }
  });
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

  // console.log({editedRulesIds});

  const rulesToStore: RuleInStorage[] = [];
  const strictModeOn = await chrome.storage.local.get(['strictMode']);
  const date = new Date();
  const unblockDate = new Date(date.getTime() + strictModeBlockPeriod).getTime();
  for (const elem of editedRulesIds) {
    const editedRow = document.getElementById(`row-${elem}`);
    if (editedRow) {
      console.log('editedRow exists');
      const rowId = Number(editedRow.querySelector('.row-id')?.textContent);
      const urlInput = editedRow.querySelector('.row-url > input') as HTMLInputElement;
      const strippedUrl = urlInput ? urlInput.value : editedRow.querySelector('.row-url')?.textContent;
      const blockDomain = (editedRow.querySelector('.domain-checkbox') as HTMLInputElement)?.checked;
      const urlToBlock = `^https?:\/\/${strippedUrl}${blockDomain ? '.*' : '$'}`;
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
            ? chrome.declarativeNetRequest.RuleActionType.REDIRECT
            : chrome.declarativeNetRequest.RuleActionType.ALLOW,
          ...(isActive && {
            redirect: {
              regexSubstitution: chrome.runtime.getURL("blocked.html")
            }
          })
        },
        condition: {
          regexFilter: urlToBlock,
          resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType]
        }
      };
      updatedRules.push(updatedRule);
      strictModeOn && !isActive && rulesToStore.push({ id: rowId, unblockDate, urlToBlock });
    }
  }
  // editedRulesIds.forEach(elem => {
  //   const editedRow = document.getElementById(`row-${elem}`);
  //   if (editedRow) {
  //     const rowId = Number(editedRow.querySelector('.row-id')?.textContent);
  //     const urlInput = editedRow.querySelector('.row-url > input') as HTMLInputElement;
  //     const strippedUrl = urlInput ? urlInput.value : editedRow.querySelector('.row-url')?.textContent;
  //     const blockDomain = (editedRow.querySelector('.domain-checkbox') as HTMLInputElement)?.checked;
  //     const urlToBlock = `^https?:\/\/${strippedUrl}${blockDomain ? '.*' : '$'}`;
  //     const isActive = (editedRow.querySelector('.active-checkbox') as HTMLInputElement)?.checked;

  //     if (!strippedUrl || forbiddenUrls.some(url => url.test(strippedUrl))) {
  //       alert('Invalid URL');
  //       editedRulesIds.clear();
  //       showEditInput = false;
  //       toggleEditMode(false);
  //       displayUrlList();
  //       console.error(`Invalid URL: ${urlToBlock}`);
  //       return;
  //     }

  //     const updatedRule: NewRule = {
  //       id: rowId,
  //       priority: 1,
  //       action: {
  //         type: isActive
  //           ? chrome.declarativeNetRequest.RuleActionType.REDIRECT
  //           : chrome.declarativeNetRequest.RuleActionType.ALLOW,
  //         ...(isActive && {
  //           redirect: {
  //             regexSubstitution: chrome.runtime.getURL("blocked.html")
  //           }
  //         })
  //       },
  //       condition: {
  //         regexFilter: urlToBlock,
  //         resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType]
  //       }
  //     };
  //     updatedRules.push(updatedRule);
  //     rulesToStore.push({ id: rowId, isActive });
  //   }
  // })

  // console.log({ updatedRules });

  const msg: UpdateAction = { action: 'updateRules', updatedRules };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success && res.rules) {
      isEdited = false;
      chrome.storage.local.set({ inactiveRules: rulesToStore });
      // chrome.storage.local.get([storageKey], result => {
      //   const rules = result.urlRules as RuleInStorage[];
      //   rules.forEach(rule => {
      //     const updatedRule = rulesToStore.find(el => el.id === rule.id);
      //     if (updatedRule) {
      //       rule.isActive = updatedRule.isActive;
      //     }
      //   });
      //   chrome.storage.local.set({ urlRules: rules });
      // });
      editedRulesIds.clear();
      displayUrlList();
      alert('Changes have been saved');
    } else {
      console.error(res.error);
      alert('Could not save changes. Check the console.');
    }
  });
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
  const strictModeOn = await chrome.storage.local.get([storageStrictModeKey]);
  console.log(`strictModeOn.strictMode: ${strictModeOn.strictMode}`);
  if (strictModeOn) {
    strictModeSwitch.checked = strictModeOn.strictMode;
  }
}
