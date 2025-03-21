import browser, { DeclarativeNetRequest } from 'webextension-polyfill';
import { forbiddenUrls, maxUrlLength, storageRulesKey, storageStrictModeKey } from "./globals";
import { getUrlToBlock, stripRegexFilter, stripUrl1 } from "./helpers";
import { Action, NewRule, ResToSend, Site, RuleInStorage } from "./types";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet('1234567890', 3); // max 1000 ids

/* 
  ? test extension on Android
  ? localization
  ? display feedback page on extension deletion
  ? add and display timestamp for each rule
  ? sort/filter rules by alphabet/active/domain
  ? block URLs with specific words in them
  ? allow blocking a list of URLs
  ? testing
  ? add tooltips
  ? add more custom messages for failed and successful actions
    - notification about a newly added rule
    - notification about rules deletion
  - when user clicks "Unblock URL", highlight that URL in the options page
*/

// on icon click
const action = chrome.action ?? browser.browserAction;
action.onClicked.addListener(tab => {
  triggerPopup(tab as browser.Tabs.Tab);
});

// on shortcut key press 
browser.commands.onCommand.addListener(async (command) => {
  const currUrl = await getCurrentUrl();
  if (command === 'trigger_form' && currUrl && !forbiddenUrls.some(url => url.test(currUrl))) {
    browser.tabs.query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs[0];
        if (tab) {
          triggerPopup(tab);
        }
      })
      .catch(error => console.error(error));
  }
});

function triggerPopup(tab: browser.Tabs.Tab) {
  if (tab.id) {
    const tabId = tab.id;
    browser.scripting.insertCSS(({
      target: { tabId },
      files: ['global.css', './popup.css'],
    }))
      .then(() => {
        browser.scripting.executeScript
          ? browser.scripting.executeScript({
            target: { tabId },
            files: ['./content.js'],
          })
          : browser.tabs.executeScript({
            file: './content.js',
          });
      })
      .catch(error => console.error(error));
  }
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  const msg = message as Action;
  if (msg.action === 'blockUrl') {
    const blackList = await getRules();
    const normalizedUrl = stripUrl1(msg.url);
    const urlToBlock = getUrlToBlock(normalizedUrl, msg.blockDomain);

    if (blackList.some(site => site.url === urlToBlock)) {
      return { success: true, status: "duplicate", msg: 'URL is already blocked' };
    }

    let newId = Number(nanoid());
    let isUnique = !blackList.some(rule => rule.id === newId);
    while (isUnique === false) {
      newId = Number(nanoid());
      isUnique = !blackList.some(rule => rule.id === newId);
    }

    const newRule: NewRule = {
      id: newId,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${newId}`
        }
      },
      condition: {
        regexFilter: urlToBlock,
        resourceTypes: ["main_frame" as DeclarativeNetRequest.ResourceType]
      }
    };

    try {
      browser.declarativeNetRequest.updateDynamicRules({
        addRules: [newRule],
        removeRuleIds: []
      });
      const res: ResToSend = { success: true, status: "added", msg: 'URL has been saved' };
      return res;
    } catch (error) {
      console.error('Error updating rules:', error);
      return { success: false, error };
    }
  } else if (msg.action === 'getRules') {
    const blackList = await getRules();
    return { success: true, status: "getRules", rules: blackList };
  } else if (msg.action === 'deleteRule') {
    // delete single rule
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [msg.deleteRuleId],
      addRules: []
    })
    return { success: true, status: "deletedRule", msg: `Rule ${msg.deleteRuleId} have been deleted` };
  } else if (msg.action === 'deleteAll') {
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map(rule => rule.id),
      addRules: []
    });
    return { success: true, status: "deleted", msg: 'All rules have been deleted' };
  } else if (msg.action === 'updateRules') {
    const uniqueFilters = new Map<string, number>();
    const filteredRules: NewRule[] = [];
    const blackList = await getRules();

    // NOTE: if getRules() is going to return map instead of array, this loop can be removed
    blackList.forEach(rule => {
      if (!uniqueFilters.has(rule.url)) {
        uniqueFilters.set(rule.url, rule.id);
      }
    });

    // remove updated rules that became duplicates
    const rulesToRemove: number[] = [];
    msg.updatedRules.forEach(rule => {
      if (uniqueFilters.has(rule.condition.regexFilter)) {
        // if a duplicate occurs
        if (uniqueFilters.get(rule.condition.regexFilter) === rule.id) {
          // remove the new duplicate rule
          filteredRules.push(rule);
        }
      } else {
        filteredRules.push(rule);
      }
      rulesToRemove.push(rule.id);
    });

    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rulesToRemove,
      addRules: filteredRules
    });
    const storedRules = await getRules();
    return { success: true, status: "updated", msg: 'Rules updated', rules: storedRules };
  } else if (msg.action === 'getCurrentUrl') {
    let currUrl = await getCurrentUrl();
    currUrl = currUrl?.substring(0, maxUrlLength - 1);
    return { success: true, status: "currUrl", url: currUrl ?? '' };
  } else {
    // will throw error if type doesn't match the existing actions
    const exhaustiveCheck: never = msg;
    throw new Error('Unhandled action');
  }
});

async function getRules(): Promise<Site[]> {
  // doesn't check if inactive rules should be enabled 
  try {
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();

    const blackList: Site[] = existingRules.map(rule => {
      return {
        id: rule.id,
        url: rule.condition.regexFilter as string,
        strippedUrl: stripRegexFilter(rule.condition.regexFilter as string),
        blockDomain: rule.condition.regexFilter ? rule.condition.regexFilter[rule.condition.regexFilter.length - 1] === '*' : true,
        isActive: rule.action.redirect ? true : false
      };
    });
    return blackList;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function getCurrentUrl() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await browser.tabs.query(queryOptions);
  return tab.url;
}

// client-side redirection (when no new requests are sent)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    const { strictMode } = await browser.storage.local.get([storageStrictModeKey]);
    if (strictMode) {
      checkInactiveRules();
    }

    const url = changeInfo.url;
    if (url) {
      const blackList = await getRules();
      blackList.forEach(rule => {
        const regex = new RegExp(rule.url);
        // block request if the URL is in the list and is active
        if (regex.test(url) && rule.isActive) {
          browser.tabs.update(tabId, { url: browser.runtime.getURL('blocked.html') });
          return;
        }
      })
    }
    return true;
  }
});

async function checkInactiveRules() {
  const result = await browser.storage.local.get([storageRulesKey]);
  const inactiveRules = result.inactiveRules as RuleInStorage[];
  const allRules = await getRules();
  const rulesToUpdate: NewRule[] = [];

  for (const rule of allRules) {
    if (!rule.isActive && !inactiveRules.some(r => r.id === rule.id)) {
      const updatedRule: NewRule = {
        id: rule.id,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${rule.id}`
          }
        },
        condition: {
          regexFilter: getUrlToBlock(rule.strippedUrl, rule.blockDomain),
          resourceTypes: ["main_frame" as DeclarativeNetRequest.ResourceType]
        }
      };
      rulesToUpdate.push(updatedRule);
    }
  }

  const currTime = new Date().getTime();
  const expiredRulesSet = new Set<number>();
  inactiveRules.forEach(rule => {
    if (rule.unblockDate < currTime) {
      const updatedRule: NewRule = {
        id: rule.id,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `${browser.runtime.getURL("blocked.html")}?id=${rule.id}`
          }
        },
        condition: {
          regexFilter: rule.urlToBlock,
          resourceTypes: ["main_frame" as DeclarativeNetRequest.ResourceType]
        }
      };
      rulesToUpdate.push(updatedRule);
      expiredRulesSet.add(rule.id);
    }
  });

  browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rulesToUpdate.map(rule => rule.id),
    addRules: rulesToUpdate
  })
    .then(() => {
      // remove rules with expired block time from the storage 
      const updatedRules = inactiveRules.filter(rule => !expiredRulesSet.has(rule.id));
      browser.storage.local.set({ inactiveRules: updatedRules });
    })
    .catch(error => console.error(error));
}
