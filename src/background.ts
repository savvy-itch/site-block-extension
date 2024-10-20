import { Action, NewRule, ResToSend, Site } from "./types";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet('1234567890', 3); // max 1000 ids

/*
  + handle form submission
  + check the current tab URL for blocked ones
  - display custom UI if the website is blocked
  ! options page
    + display list of rules
    + allow rule deletion
    + allow rule editing
      + when editing a URL, on save make sure it doesn't become a duplicate of an existing URL
    + rewrite rules using regex
  - testing
  - add regex to form (specific URl/the whole domain blocking toggle);
  - remove form after successful submission
  - add permanent/temporary block option
  - customize block page
  - customize options page
  ? make cross browser versions
  ? block URLs with specific words in them 
  ? allow blocking a list of URLs
  ? replace nanoid with Math.random

  Bugs:
  + block domain doesn't work correctly
  + incorrect block domain checkbox state in the table 
  + save/edit buttons don't are always available
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
      // const urlToBlock = `||${normalizedUrl}/${msg.blockDomain ? '*' : '|'}`;
      const urlToBlock = `^https?:\/\/${normalizedUrl}\/${msg.blockDomain ? '.*': '$'}`;
      console.log({ normalizedUrl, urlToBlock, blockDomain: msg.blockDomain });

      if (blackList.some(site => site.url === urlToBlock)) {
        console.log('This URL is already in the list');
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
            // url: chrome.runtime.getURL("blocked.html")
            regexSubstitution: chrome.runtime.getURL("blocked.html")
          }
        },
        condition: {
          // urlFilter: urlToBlock,
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
      console.log({blackList});
      sendResponse({ success: true, status: "getRules", rules: blackList });
    } else if (msg.action === 'deleteRule') {
      // const blackList = await getRules();
      // delete single rule
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [msg.deleteRuleId],
        addRules: []
      })
        .then(() => {
          sendResponse({ success: true, status: "deletedRule", msg: `Rule ${msg.deleteRuleId} have been deleted` });
        })
        // .finally(() => console.log(`Updated rules: ${blackList}`))
    } else if (msg.action === 'deleteAll') {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      // delete rules
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map(rule => rule.id),
        addRules: []
      })
        .then(() => {
          sendResponse({ success: true, status: "deleted", msg: 'All rules have been deleted' });
        })
    } else if (msg.action === 'updateRules') {
      // remove updated rule if it becomes a duplicate
      const uniqueFilters = new Map();
      const filteredRules: NewRule[] = [];
      const blackList = await getRules();

      console.log({updatedRules: msg.updatedRules});

      blackList.forEach(rule => {
        if (!uniqueFilters.has(rule.url)) {
          uniqueFilters.set(rule.url, rule.id);
        }
      });

      msg.updatedRules.forEach(rule => { 
        if (!uniqueFilters.has(rule.condition.regexFilter)) {
          filteredRules.push(rule);
        }
      })

      console.log({filteredRules});

      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: msg.updatedRules.map(rule => rule.id),
        addRules: filteredRules
      })
        .then(() => {
          sendResponse({ success: true, status: "updated", msg: 'Rules updated' });
        })
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
    const blackList: Site[] = existingRules.map(rule => ({
      id: rule.id,
      url: rule.condition.regexFilter as string,
      blockDomain: rule.condition.regexFilter ? rule.condition.regexFilter[rule.condition.regexFilter.length - 1] === '*' : true
    }));
    return blackList;
  } catch (error) {
    console.error(error);
    return [];
  }
}

// client-side redirection (when no new requests are sent)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url;
  if (url) {
    const blackList = await getRules();
    blackList.forEach(rule => {
      const regex = new RegExp(rule.url);
      if (regex.test(url)) {
        chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
        console.log('redirected through tabs');
        return;
      }
    })
  }
  return true;
});
