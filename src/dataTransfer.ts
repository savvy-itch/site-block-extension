import browser, { DeclarativeNetRequest } from 'webextension-polyfill';
import { AddAction, NewRule, ResToSend, RuleInStorage, Site, UpdateAction } from "./types";
import { STORAGE_INACTIVE_RULES } from './globals';

interface Settings {
  darkMode?: string,
  disableLimit?: number,
  inactiveRules?: RuleInStorage[],
};

interface ImportedData {
  settings: Settings,
  rules: Site[]
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

export function separateUniqueFromDuplicates(importedRules: Site[], cachedRules: Site[]): { uniqueRules: Site[], duplicates: Site[] } {
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
    .finally(() => console.log(`Unique ID assignment completed. Found: ${uniqueRules.length}`));
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
  console.log(`duplicates handled. Found: ${updatedDuplicates.length}`);
  return res;
}
