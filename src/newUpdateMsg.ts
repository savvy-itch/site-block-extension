import browser from 'webextension-polyfill';
import { STORAGE_PREV_UPDATE_VERSION } from "./globals";
import { UpdateMsg } from "./types";

const lastUpdateContent: UpdateMsg = {
  v: '1.1.0',
  desc: 'This is test update message'
};

document.addEventListener('DOMContentLoaded', async () => {
  const prevUpdate = await browser.storage.local.get([STORAGE_PREV_UPDATE_VERSION]);
  const updateVersion = prevUpdate[STORAGE_PREV_UPDATE_VERSION] as string;
  console.log({prevUpdate, updateVersion});

  if (!prevUpdate || !updateVersion || updateVersion !== lastUpdateContent.v) {  
    displayUpdateMsg();
  }
});

function displayUpdateMsg() {
  const msgElem = document.createElement('div');
  msgElem.classList.add('extension-update-popup');
  msgElem.innerHTML = `
    <div class="extension-update-popup-container">
      <h2>Your extension has received a new update to v${lastUpdateContent.v}!</h2>
      <h3>What's new?</h3>
      <p>${lastUpdateContent.desc}</p>
    </div>
  `;
  const closeBtn = document.createElement('button');
  closeBtn.classList.add('popup-close-btn');
  closeBtn.ariaLabel = 'close popup';
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#574f59" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  `;
  closeBtn.addEventListener('click', () => {
    msgElem.classList.add('collapse-popup');
    browser.storage.local.set({ [STORAGE_PREV_UPDATE_VERSION]: lastUpdateContent.v })
  });
  msgElem.appendChild(closeBtn);
  document.body.insertAdjacentElement('afterbegin', msgElem);
}
