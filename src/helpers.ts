import browser, { DeclarativeNetRequest } from 'webextension-polyfill';
import { AddAction, DeleteAllAction, GetAllAction, NewRule, ResToSend, RuleInStorage, Site, UpdateAction } from "./types";
import { DEFAULT_DISABLE_LIMIT, FORBIDDEN_URLS, MAX_URL_LEN, MIN_URL_LEN, PREV_RESET_DATE, STORAGE_INACTIVE_RULES, STRICT_MODE_BLOCK_PERIOD, WEB_STORES_LIST } from './globals';

export function assignStoreLink(webStoreLink: HTMLAnchorElement) {
  const browser = navigator.userAgent;
  if (browser.includes('Firefox/')) {
    webStoreLink.href = WEB_STORES_LIST.firefox;
  } else if (browser.includes('Edg/')) {
    webStoreLink.href = WEB_STORES_LIST.edge;
  } else {
    webStoreLink.href = WEB_STORES_LIST.chrome;
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
    if (!urlToBlock || FORBIDDEN_URLS.some(url => url.test(urlToBlock))) {
      if (errorPara) {
        errorPara.textContent = 'Invalid URL';
      }
      console.error(`Invalid URL: ${urlToBlock}`);
      return;
    } else if (urlToBlock.length < MIN_URL_LEN) {
      if (errorPara) {
        errorPara.textContent = 'URL is too short';
      }
      console.error(`URL is too short`);
      return;
    } else if (urlToBlock.length > MAX_URL_LEN) {
      if (errorPara) {
        errorPara.textContent = 'URL is too long';
      }
      console.error(`URL is too long`);
      return;
    }

    const msg: AddAction = { action: "blockUrl", url: urlToBlock, blockDomain, isActive: true };

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
        const unblockDate = new Date(date.getTime() + STRICT_MODE_BLOCK_PERIOD).getTime();
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
      await browser.storage.local.set({ disableLimit: DEFAULT_DISABLE_LIMIT });
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
};

interface ImportedData {
  settings: Settings,
  rules: Site[]
}

export async function getSettingsFromStorage(): Promise<Settings> {
  const keys: (keyof Settings)[] = ["darkMode", "disableLimit", STORAGE_INACTIVE_RULES];

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

export async function importData(reader: FileReader, dataPara: HTMLParagraphElement, cachedRules: Site[]) {
  if (typeof (reader.result) === "string") {
    const res: ImportedData = JSON.parse(reader.result);
    if (!isImportStructureValid(res)) {
      dataPara.textContent = "Invalid file structure";
      console.error("Invalid file structure");
    }

    try {
      const newData: ImportedData = await saveRules(res, cachedRules);
      const { settings } = newData;
      for (const [key, value] of Object.entries(settings)) {
        await browser.storage.local.set({ [key]: value });
      }
      dataPara.textContent = "";
    } catch (error) {
      dataPara.textContent = String(error);
      console.error(error);
    }
  } else {
    dataPara.textContent = "Error during data parsing";
    console.error("Error during data parsing");
  }
}

function isImportStructureValid(data: ImportedData): boolean {
  return (data.settings && data.rules
    && Array.isArray(data.rules)
  )
    ? true
    : false;
}

/*
  Assigns new IDs and saves the rules.
*/
async function saveRules(dataObj: ImportedData, cachedRules: Site[]): Promise<ImportedData> {
  const updatedData = dataObj;
  const { uniqueRules, duplicates } = separateUniqueFromDuplicates(updatedData.rules, cachedRules);

  // handle unique rules
  const res = await saveUniqueRules(uniqueRules);
  const failures = res.filter(r => r.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      failures.map(f => String(f.reason)).join("; ")
    );
  }

  // handle duplicate rules
  const res2 = await updateDuplicates(duplicates);
  if (!res2.success) {
    throw new Error(res2.error);
  }

  updatedData.rules = [...uniqueRules, ...duplicates];

  if (updatedData.settings.inactiveRules && updatedData.settings.inactiveRules.length > 0) {
    updatedData.settings.inactiveRules.map(ir => {
      const match = updatedData.rules.find(r => r.url === ir.urlToBlock);
      if (match) {
        ir.id = match.id;
      }
    });
  }

  return updatedData;
}

function separateUniqueFromDuplicates(importedRules: Site[], cachedRules: Site[]): { uniqueRules: Site[], duplicates: Site[] } {
  const uniqueRules: Site[] = [];
  const duplicates: Site[] = [];

  for (const rule of importedRules) {
    const match = cachedRules.find(cr => cr.strippedUrl === rule.strippedUrl);
    if (match) {
      duplicates.push({ ...rule, id: match.id });
    } else {
      uniqueRules.push(rule);
    }
  }

  return { uniqueRules, duplicates };
}

async function saveUniqueRules(uniqueRules: Site[]): Promise<PromiseSettledResult<ResToSend>[]> {
  return await Promise.allSettled(uniqueRules.map(async (rule) => {
    const msg: AddAction = { action: "blockUrl", url: rule.strippedUrl, blockDomain: rule.blockDomain, isActive: rule.isActive };
    const res: ResToSend = await browser.runtime.sendMessage(msg);
    if (res.status === "added" && res.id) {
      rule.id = res.id;
    }
    return res;
  }))
    .finally(() => console.log("Unique ID assignment completed"));
}

async function updateDuplicates(duplicates: Site[]): Promise<ResToSend> {
  const updatedDuplicates: NewRule[] = [];
  duplicates.map((rule) => {
    const updatedRule: NewRule = {
      id: rule.id,
      priority: 1,
      action: {
        type: rule.isActive ? "redirect" : "allow",
      },
      condition: {
        regexFilter: rule.url,
        resourceTypes: ["main_frame" as DeclarativeNetRequest.ResourceType]
      }
    };

    if (rule.isActive) {
      updatedRule.action.redirect = {
        regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${rule.id}`
      }
    }
    updatedDuplicates.push(updatedRule);
  });

  const msg: UpdateAction = { action: "updateRules", updatedRules: updatedDuplicates };

  const res: ResToSend = await browser.runtime.sendMessage(msg);
  return res;
}
