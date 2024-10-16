import { CustomReq, ResToSend } from "./types";

const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tbody = document.getElementById('url-table');
let isEdited = false;

document.addEventListener('DOMContentLoaded', () => {
  saveBtn?.setAttribute('disabled', `${isEdited}`);
  cancelBtn?.setAttribute('disabled', `${isEdited}`);
});

function handleEdit(bool: boolean) {
  isEdited = bool;
  saveBtn?.setAttribute('disabled', `${isEdited}`);
  cancelBtn?.setAttribute('disabled', `${isEdited}`);
}

function displayUrlList() {
  const msg: CustomReq = { action: 'getRules' };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      // console.log(res.rules);
      if (res.rules && tbody) {
        tbody.innerHTML = '';
        const urlList = res.rules;
        urlList.map((rule, i) => {
          const ruleElem = document.createElement('tr');
          ruleElem.id = `row-${rule.id}`;
          const strippedUrl = rule.url.replace(/^[||]{2}/, '').replace(/\*|\|$/, '');
          const content = `
            <td>${i+1}</td>
            <td>${rule.id}</td>
            <td>${strippedUrl}</td>
            <td>
              <input 
                classname="domain-checkbox"
                name="domain"
                type="checkbox"
                checked=${rule.blockDomain}
              />
            </td>
            <td>
              <button>Edit</button>
            </td>
            <td>
              <button class="delete-rule-btn">Delete</button>
            </td>
          `;
          ruleElem.innerHTML = content;
          tbody.appendChild(ruleElem);

          const deleteRuleRow = document.getElementById(`row-${rule.id}`);
          const deleteBtn = deleteRuleRow?.querySelector('.delete-rule-btn');
          if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
              deleteRule(rule.id);
            });
          }

          const domainToggle = deleteRuleRow?.querySelector('.domain-checkbox');
          domainToggle?.addEventListener('change', () => {
            handleEdit(true);
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
  const msg: CustomReq = { action: "deleteRule", deleteRuleId: id };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      displayUrlList();
    } else {
      alert('Error: Could not delete the rule')
      console.error(res.error);
    }
  })
}
