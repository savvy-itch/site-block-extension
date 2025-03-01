import browser from 'webextension-polyfill';
import { AddAction, DeleteAllAction, GetAllAction, ResToSend, RuleInStorage } from "./types";
import { defaultDisableLimit, forbiddenUrls, maxUrlLength, minUrlLength, PREV_RESET_DATE, strictModeBlockPeriod, webStores } from './globals';

/*
Brave:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
Chrome:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
Opera:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0'
Firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
Edge:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
*/

export function assignStoreLink(webStoreLink: HTMLAnchorElement) {
  const browser = navigator.userAgent;
  if (browser.includes('Firefox/')) {
    webStoreLink.href = webStores.firefox;
  } else if (browser.includes('Edg/')) {
    webStoreLink.href = webStores.edge;
  } else {
    webStoreLink.href = webStores.chrome;
  }
}

export function getExtVersion() {
  const v = browser.runtime.getManifest().version;
  return v;
}

export function stripUrl(url: string): string {
  return url.replace(/^\^https\?:\/\//, '').replace(/\?\.\*|\?\$$/, '');
}

export async function deleteRules() {
  const msg: DeleteAllAction = { action: 'deleteAll' };
  try {
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    if (res.success) {
      alert('All rules have been deleted');
    }
  } catch (error) {
    alert('An error occured. Check the console.');
    console.error(error);
  }
}

export async function handleFormSubmission(urlForm: HTMLFormElement, errorPara: HTMLParagraphElement, successFn: Function) {
  if (urlForm && errorPara && successFn) {
    const formData = new FormData(urlForm);
    const urlToBlock = formData.get('url') as string;
    const blockDomain = (document.getElementById('block-domain') as HTMLInputElement).checked;
    errorPara.textContent = '';

    // handle errors
    if (!urlToBlock || forbiddenUrls.some(url => url.test(urlToBlock))) {
      if (errorPara) {
        errorPara.textContent = 'Invalid URL';
      }
      console.error(`Invalid URL: ${urlToBlock}`);
      return;
    } else if (urlToBlock.length < minUrlLength) {
      if (errorPara) {
        errorPara.textContent = 'URL is too short';
      }
      console.error(`URL is too short`);
      return;
    } else if (urlToBlock.length > maxUrlLength) {
      if (errorPara) {
        errorPara.textContent = 'URL is too long';
      }
      console.error(`URL is too long`);
      return;
    }

    const msg: AddAction = { action: "blockUrl", url: urlToBlock, blockDomain };

    try {
      const res: ResToSend = await browser.runtime.sendMessage(msg);
      if (res.success) {
        if (res.status === 'added') {
          successFn();
          const urlInput = urlForm.querySelector('.url-input') as HTMLInputElement;
          urlInput.value = '';
        } else if (res.status === 'duplicate') {
          errorPara.textContent = 'URL is already blocked';
          // alert('URL is already blocked');
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}

export function displayLoader(wrapperElem: HTMLDivElement) {
  if (wrapperElem) {
    const loader = document.createElement('div');
    loader.classList.add('loader');
    wrapperElem.innerHTML = '';
    wrapperElem.appendChild(loader);
  }
}

export async function handleInactiveRules(isStrictModeOn: boolean) {
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
          if (!rule.isActive) {
            const urlToBlock = `^https?:\/\/${rule.strippedUrl}?${rule.blockDomain ? '\/?.*' : '\/?$'}`;
            inactiveRulesToStore.push({ id: rule.id, unblockDate: unblockDate, urlToBlock })
          }
        });
        browser.storage.local.set({ inactiveRules: inactiveRulesToStore });
      }
    } catch (error) {
      console.error(error);
    }
  }
}

export function disableOtherBtns(tbody: HTMLTableSectionElement, ruleId: number) {
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

export async function checkLastLimitReset() {
  const dateResult = await browser.storage.local.get(PREV_RESET_DATE);
  const rawDate = dateResult[PREV_RESET_DATE] as string;

  if (!rawDate || isNaN(new Date(rawDate).getTime())) {
    await browser.storage.local.set({ [PREV_RESET_DATE]: new Date().toISOString() });
  } else {
    const prevDate = new Date(rawDate);
    const currDate = new Date();
    if (prevDate.getFullYear() < currDate.getFullYear() ||
      prevDate.getMonth() < currDate.getMonth() ||
      prevDate.getDate() < currDate.getDate()) {
      await browser.storage.local.set({ [PREV_RESET_DATE]: new Date().toISOString() });
      await browser.storage.local.set({ disableLimit: defaultDisableLimit });
    }
  }
}

export function getUrlToBlock(strippedUrl: string, blockDomain: boolean) {
  return `^https?:\/\/${strippedUrl}${blockDomain ? '\/?.*' : '\/?$'}`
}
