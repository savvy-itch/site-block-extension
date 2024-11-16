import browser from 'webextension-polyfill';
import { DeleteAction, GetAllAction, ResToSend } from './types';

const para = document.getElementById('blocked-url');
const deleteBtn = document.getElementById('delete-btn');
const params = new URLSearchParams(location.search);
const urlId = Number(params.get('id'));
let blockedUrl: string | undefined = '';

document.addEventListener('DOMContentLoaded', () => {
  if (para && urlId) {
    getBlockedUrl();
  }
});

deleteBtn?.addEventListener('click', () => {
  deleteRule(urlId);
})

async function  getBlockedUrl() {
  const msg:GetAllAction = { action: 'getRules' };

  try {
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    if (res.success && res.rules) {
      blockedUrl = res.rules.find(rule => rule.id === urlId)?.strippedUrl;
      if (blockedUrl) {
        para!.textContent = blockedUrl;
        deleteBtn?.removeAttribute('disabled');
      } else {
        para!.textContent = 'Could not get the URL.';
        deleteBtn?.setAttribute('disabled', '');
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function deleteRule(id: number) {
  const msg: DeleteAction = { action: "deleteRule", deleteRuleId: id };
  const res: ResToSend = await browser.runtime.sendMessage(msg);
  try {
    if (res.success) {
      if (blockedUrl) {
        console.log(blockedUrl);
        window.location.replace(`https://${blockedUrl}`);
      }
    }
  } catch (error) {
    console.error(res.error);
    alert('Error: Could not delete the rule')
  }
}
