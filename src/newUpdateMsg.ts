import browser from 'webextension-polyfill';
import { STORAGE_PREV_UPDATE_VERSION } from "./globals";
import { UpdateMsg } from "./types";
import { getExtVersion } from './helpers';

const lastUpdateContent: UpdateMsg = {
  v: getExtVersion(),
  desc: [`
    Strict mode daily limit: when strict mode is enabled, you can disable URLs up to 3 times per day. The limit resets daily.`,
    `List search: you can now search the URLs from the block list.`
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  const prevUpdate = await browser.storage.local.get([STORAGE_PREV_UPDATE_VERSION]);
  const updateVersion = prevUpdate[STORAGE_PREV_UPDATE_VERSION] as string;

  if (!prevUpdate || !updateVersion || updateVersion !== lastUpdateContent.v) {  
    displayUpdateMsg();
  }
});

function displayUpdateMsg() {
  const msgElem = document.createElement('div');
  msgElem.classList.add('extension-update-popup');

  const msgInnerDiv = document.createElement('div');
  msgInnerDiv.classList.add('extension-update-popup-container');

  const msgHeading = document.createElement('h2');
  msgHeading.textContent = `Your extension has received an update to v${lastUpdateContent.v}!`;

  const msgSubheading = document.createElement('h3');
  msgSubheading.textContent = 'What\'s new?';

  msgInnerDiv.appendChild(msgHeading);
  msgInnerDiv.appendChild(msgSubheading);
  
  lastUpdateContent.desc.forEach(str => {
    const msgContent = document.createElement('p');
    msgContent.textContent = str;
    msgInnerDiv.appendChild(msgContent);
  });

  msgElem.appendChild(msgInnerDiv);

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
