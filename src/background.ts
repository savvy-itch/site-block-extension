import { storageKey } from "./globals";
import { stripUrl } from "./helpers";
import { Action, NewRule, ResToSend, Site, RuleInStorage } from "./types";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet('1234567890', 3); // max 1000 ids

/* 
  - delete all rules button on options page
  - customize form
  - customize block page
  - customize options page
  - make cross browser versions
  - add more custom messages for failed and successful actions 
  ? add strict mode - when user disables a rule, it automatically gets reenabled in 1h
  ? block URLs with specific words in them 
  ? allow blocking a list of URLs
  ? replace nanoid with Math.random
  ? testing

  Edge cases:
  Popup:
  + don't display popup on options and blocked page
  + don't allow adding block page to the list
  + adding an existing URL (when one is temporarily disabled)
*/

// on icon click
chrome.action.onClicked.addListener(tab => {
  triggerPopup(tab);
});

// on shortcut key press
chrome.commands.onCommand.addListener(command => {
  if (command === 'trigger_form') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        triggerPopup(tab);
      }
    })
  }
})

function triggerPopup(tab: chrome.tabs.Tab) {
  if (tab.id) {
    const tabId = tab.id;
    chrome.scripting.insertCSS(({
      target: { tabId },
      files: ['./popup.css'],
    }))
      .then(() => {
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['./content.js'],
        })
      })
      .catch(error => console.error(error));
  }
}

chrome.runtime.onMessage.addListener((msg: Action, sender, sendResponse: (response: ResToSend) => void) => {
  (async () => {
    if (msg.action === 'blockUrl') {
      const blackList = await getRules();
      const normalizedUrl = msg.url?.replace(/^https?:\/\//, '').replace(/\/$/, ''); // remove the protocol and the last slash
      const urlToBlock = `^https?:\/\/${normalizedUrl}\/${msg.blockDomain ? '.*' : '$'}`;

      if (blackList.some(site => site.url === urlToBlock)) {
        sendResponse({ success: true, status: "duplicate", msg: 'URL is already blocked' });
        return;
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
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: {
            regexSubstitution: chrome.runtime.getURL("blocked.html")
          }
        },
        condition: {
          regexFilter: urlToBlock,
          resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType]
        }
      };

      console.log({ newRule });

      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [newRule],
        removeRuleIds: []
      })
        .then(() => {
          sendResponse({ success: true, status: "added", msg: 'URL has been saved' });
        })
        .catch(error => {
          console.error('Error updating rules:', error);
          sendResponse({ success: false, error });
        })
        .finally(() => console.log(`Updated rules: ${blackList}`))
    } else if (msg.action === 'getRules') {
      const blackList = await getRules();
      console.log({ blackList });
      sendResponse({ success: true, status: "getRules", rules: blackList });
    } else if (msg.action === 'deleteRule') {
      // delete single rule
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [msg.deleteRuleId],
        addRules: []
      })
      sendResponse({ success: true, status: "deletedRule", msg: `Rule ${msg.deleteRuleId} have been deleted` });
    } else if (msg.action === 'deleteAll') {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      // delete rules
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map(rule => rule.id),
        addRules: []
      });
      sendResponse({ success: true, status: "deleted", msg: 'All rules have been deleted' });
    } else if (msg.action === 'updateRules') {
      const uniqueFilters = new Map<string, number>();
      const filteredRules: NewRule[] = [];
      const blackList = await getRules();

      console.log({ updatedRules: msg.updatedRules });

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
        }
        rulesToRemove.push(rule.id);
      });

      console.log({ filteredRules });

      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rulesToRemove,
        addRules: filteredRules
      })
        .then(() => getRules())
        .then((storedRules) => {
          sendResponse({ success: true, status: "updated", msg: 'Rules updated', rules: storedRules });
        });
    } else if (msg.action === 'getCurrentUrl') {
      const currUrl = await getCurrentUrl();
      sendResponse({ success: true, status: "currUrl", url: currUrl ?? '' });
    } else {
      // will throw error if type doesn't match the existing actions
      const exhaustiveCheck: never = msg;
    }
  })();
  return true;
});

async function getRules(): Promise<Site[]> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    // const result = await chrome.storage.local.get([storageKey]);
    // const storedRules = result.urlRules as RuleInStorage[] || [];

    const blackList: Site[] = existingRules.map(rule => ({
      id: rule.id,
      url: rule.condition.regexFilter as string,
      strippedUrl: stripUrl(rule.condition.regexFilter as string),
      blockDomain: rule.condition.regexFilter ? rule.condition.regexFilter[rule.condition.regexFilter.length - 1] === '*' : true,
      // isActive: storedRules.find(el => el.id === rule.id)?.isActive ?? true
      isActive: rule.action.redirect ? true : false
    }));
    return blackList;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function getCurrentUrl() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  console.log(tab.url);
  return tab.url;
}

// client-side redirection (when no new requests are sent)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url;
  if (url) {
    const blackList = await getRules();
    blackList.forEach(rule => {
      const regex = new RegExp(rule.url);
      // block request if the URL is in the list and is active
      if (regex.test(url) && rule.isActive) {
        chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
        console.log('redirected through tabs');
        return;
      }
    })
  }
  return true;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(newValue);
  }
});
