import { DeleteAction, GetAllAction, NewRule, ResToSend, UpdateAction } from "./types";

const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tbody = document.getElementById('url-table');
let isEdited = false;
let showEditInput = false;
let editedRulesIds: number[] = [];

document.addEventListener('DOMContentLoaded', () => {
  saveBtn?.setAttribute('disabled', '');
  cancelBtn?.setAttribute('disabled', '');
});

cancelBtn?.addEventListener('click', () => {
  editedRulesIds = [];
  showEditInput = false;
  toggleEditMode(false);
  displayUrlList();
});

saveBtn?.addEventListener('click', () => {
  saveChanges();
  editedRulesIds = [];
})

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
  // console.log('displayUrlList');
  const msg: GetAllAction = { action: 'getRules' };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      // console.log({ rules: res.rules });
      if (res.rules && tbody) {
        tbody.innerHTML = '';
        const urlList = res.rules;
        urlList.map((rule, i) => {
          const ruleElem = document.createElement('tr');
          ruleElem.id = `row-${rule.id}`;
          ruleElem.classList.add('row');
          // const strippedUrl = rule.url.replace(/^\^/, '').replace(/\*|\$$/, '');
          const strippedUrl = rule.url.replace(/^\^https\?:\/\//, '').replace(/\.\*|\$$/, '');
          const content = `
            <td>${i + 1}</td>
            <td class="row-id">${rule.id}</td>
            <td class="row-url">${strippedUrl}</td>
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
          `;
          ruleElem.innerHTML = content;
          tbody.appendChild(ruleElem);

          const updateRuleRow = document.getElementById(`row-${rule.id}`);
          const editBtn = updateRuleRow?.querySelector('.edit-rule-btn');
          if (editBtn) {
            editBtn.addEventListener('click', () => {
              if (!showEditInput) {
                showEditInput = true;
                editedRulesIds.push(rule.id)
                disableOtherBtns(rule.id);
                toggleEditMode(true);
                const urlCell = updateRuleRow?.querySelector('.row-url');
                if (urlCell) {
                  urlCell.innerHTML = `
                    <input
                      name="url"
                      type="text"
                      value=${strippedUrl}
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
          // console.log(domainToggle);
          domainToggle?.addEventListener('change', () => {
            console.log('checkbox toggled');
            toggleEditMode(true);
            editedRulesIds.push(rule.id);
          });
        });
      }
    } else {
      alert('An error occured. Check the console.');
      console.error(res.error);
    }
  })
}

displayUrlList();

function deleteRule(id: number) {
  console.log(`Called deleteRule for ID: ${id}`);
  const msg: DeleteAction = { action: "deleteRule", deleteRuleId: id };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      showEditInput = false;
      displayUrlList();
    } else {
      alert('Error: Could not delete the rule')
      console.error(res.error);
    }
  });
}

function saveChanges() {
  let updatedList: NewRule[] = [];

  if (editedRulesIds.length === 0) {
    toggleEditMode(false);
    showEditInput = false;
    displayUrlList();
    alert('No changes were made');
    return;
  }

  editedRulesIds
    .filter(elem => document.getElementById(`row-${elem}`))
    .map(id => {
      const editedRow = document.getElementById(`row-${id}`);

      if (editedRow) {
        const rowId = Number(editedRow.querySelector('.row-id')?.textContent);
        const strippedUrl = (editedRow.querySelector('.row-url > input') as HTMLInputElement)?.value;
        const blockDomain = (editedRow.querySelector('.domain-checkbox') as HTMLInputElement)?.checked;
        const urlToBlock = `^https?:\/\/${strippedUrl}${blockDomain ? '.*' : '$'}`;
        console.log({ blockDomain, urlToBlock, elem: editedRow.querySelector('.domain-checkbox') as HTMLInputElement });

        const updatedRule: NewRule = {
          id: rowId,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: {
              // url: chrome.runtime.getURL("blocked.html")
              regexSubstitution: chrome.runtime.getURL("blocked.html")
            }
          },
          condition: {
            // urlFilter: urlToBlock,
            regexFilter: urlToBlock,
            resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType]
          }
        };
        updatedList.push(updatedRule);
      }
    });
    console.log(editedRulesIds);

  // checkForDuplicatesAfterUpdate(updatedList);

  const msg: UpdateAction = { action: 'updateRules', updatedRules: updatedList };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      isEdited = false;
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
  })
}

// DO I STILL NEED THIS FUNCTION?
// check if after editing rules, some of the changes are identical
function checkForDuplicatesAfterUpdate(updatedList: NewRule[]) {
  const uniqueFilters = new Set<string>();
  const tempArr: NewRule[] = [];

  updatedList.forEach(rule => {
    if (!uniqueFilters.has(rule.condition.regexFilter)) {
      uniqueFilters.add(rule.condition.regexFilter);
      tempArr.push(rule);
    }
  });

  console.log({tempArr, updatedList});
  updatedList = tempArr;
  return updatedList;
}
