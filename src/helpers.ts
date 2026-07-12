import browser from 'webextension-polyfill';
import { AddAction, DeleteAllAction, GetAllAction, ResToSend, RuleInStorage, Site } from "./types";
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
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '') + '/';
}

export function stripRegexFilter(url: string): string {
  // www.foo.com/
  return url.replace(/^\^https\?:\/\//, '').replace(/\?\.\*|\?\$$/, '').replace(/\/+$/, '') + '/';
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
            const urlToBlock = getUrlToBlock(rule.strippedUrl, rule.blockDomain);
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
  return `^https?:\/\/${strippedUrl}${blockDomain ? '?.*' : '?$'}`;
}

export async function exportData(cachedRules: Site[]) {
  console.log("exportData");
  const filename = "on-pace-data.json";
  let url = "";

  try {
    const data = await getSettingsFromStorage();
    const dataObj = { settings: data, rules: cachedRules };
    const settings = new Blob([JSON.stringify(dataObj)], { type: "application/json" });
    url = URL.createObjectURL(settings);
    const options: browser.Downloads.DownloadOptionsType = {
      filename,
      saveAs: true,
      url
    };
    await browser.downloads.download(options);
  } catch (error) {
    console.error(error);
  } finally {
    console.log("data exported");
    if (url) URL.revokeObjectURL(url);
  }
}

interface Settings {
  darkMode?: string,
  disableLimit?: number,
  inactiveRules?: RuleInStorage[],
  prevResetDate?: string,
  prevUpdate?: string,
  strictMode?: boolean
};

interface ImportData {
  settings: Settings,
  rules: Site[]
}

export async function getSettingsFromStorage(): Promise<Settings> {
  const keys: (keyof Settings)[] = ["darkMode", "disableLimit", "inactiveRules", "prevResetDate", "prevUpdate", "strictMode"];

  const entries = await Promise.all(
    keys.map(async (key) => {
      const obj = await browser.storage.local.get(key);
      // explicit null check is needed to prevent skipping keys with "false" values
      return obj[key] !== null ? [key, obj[key]] : null;
    })
  );

  return Object.fromEntries(entries.filter(e => e !== null));
}

export function openFile(importInput: HTMLInputElement, reader: FileReader) {
  if (importInput.files) {
    const file = importInput.files[0];
    if (file.type !== "application/json") {
      alert(`Unsupported format. Expected .json, got ${file.type}`);
      return;
    }
    reader.readAsText(file);
  }
}

export async function importData(reader: FileReader) {
  if (typeof (reader.result) === "string") {
    const res: ImportData = JSON.parse(reader.result);
    const newData: ImportData = await assignNewIds(res);
    console.log(newData);
    const settings: Settings = newData.settings;
    for (const [key, value] of Object.entries(settings)) {
      if (key !== "prevResetDate" && key !== "prevUpdate" && key !== "strictMode") {
        await browser.storage.local.set({ [key]: value });
      }
    }
  } else {
    console.error("Error during data parsing");
  }
}

/*
interface Site {
  id: number,
  url: string,
  strippedUrl: string,
  blockDomain: boolean,
  isActive: boolean
}

interface RuleInStorage {
  id: number,
  unblockDate: number,
  urlToBlock: string
}
*/

async function assignNewIds(dataObj: ImportData): Promise<ImportData> {
  const updatedData = dataObj;
  await Promise.allSettled(updatedData.rules.map(async (rule) => {
    const msg: AddAction = { action: "blockUrl", url: rule.strippedUrl, blockDomain: rule.blockDomain };
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    if (res.success) {
      if (res.status === 'added') {
        console.log("added");
        if (updatedData.settings.inactiveRules && updatedData.settings.inactiveRules.length > 0) {
          const match = updatedData.settings.inactiveRules.find(r => r.urlToBlock === rule.url);
          if (match && res.id) {
            match.id = res.id;
          }
        }
      } else if (res.status === 'duplicate') {
        console.log("duplicate");
      }
    }
  }))
    .catch(err => console.error(err))
    .finally(() => console.log("ID assignment completed"));

  return updatedData;
}

/**
{
    "settings": {
        "darkMode": "dark",
        "disableLimit": 2,
        "inactiveRules": [
            {
                "id": 510,
                "unblockDate": 1783621073277,
                "urlToBlock": "^https?://colorhunt.co/palettes/light/?.*"
            }
        ],
        "prevResetDate": "2026-07-09T11:39:37.916Z",
        "prevUpdate": "1.1.1",
        "strictMode": true
    },
    "rules": [
        {
            "id": 510,
            "url": "^https?://colorhunt.co/palettes/light/?.*",
            "strippedUrl": "colorhunt.co/palettes/light/",
            "blockDomain": true,
            "isActive": false
        },
        {
            "id": 656,
            "url": "^https?://example.com/?.*",
            "strippedUrl": "example.com/",
            "blockDomain": true,
            "isActive": true
        }
    ]
}
 */
