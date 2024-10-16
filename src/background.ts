import { CustomReq, NewRule, ResToSend, Site } from "./types";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet('1234567890', 3); // max 1000 ids

/*
  + handle form submission
  + check the current tab URL for blocked ones
  - display custom UI if the website is blocked
  ! options page
    + display list of rules
    + allow rule deletion
    ! allow rule editing
  - add regex to form (specific URl/the whole domain blocking toggle);
  - remove form after successful submission
  - add permanent/temporary block option
  - customize block page
  - customize options page
  ? make cross browser versions
  ? block URLs with specific words in them 
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

chrome.runtime.onMessage.addListener((msg: CustomReq, sender, sendResponse: (response: ResToSend) => void) => {
  chrome.declarativeNetRequest.getDynamicRules()
    .then(existingRules => {
      const blackList: Site[] = existingRules.map(rule => ({
        id: rule.id,
        url: rule.condition.urlFilter as string,
        blockDomain: msg.blockDomain as boolean
      }));
      console.log({ blackList });

      // form submission
      if (msg.action === 'blockUrl') {
        const normalizedUrl = msg.url?.replace(/^https?:\/\//, '').replace(/\/$/, ''); // remove the protocol and the last slash
        const urlToBlock = `||${normalizedUrl}/${msg.blockDomain ? '*' : '|'}`;
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
              url: chrome.runtime.getURL("blocked.html")
            }
          },
          condition: {
            urlFilter: urlToBlock,
            resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType]
          }
        };

        console.log({ newRule });

        // console.log(`Redirect URL: ${chrome.runtime.getURL("blocked.html")}`);

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
      } else if (msg.action === 'deleteAll') {
        // delete rules
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRules.map(rule => rule.id),
          addRules: []
        })
          .then(() => {
            sendResponse({ success: true, status: "deleted", msg: 'All rules have been deleted' });
          })
          .finally(() => console.log(`Updated rules: ${blackList}`))
      } else if (msg.action === 'getRules') {
        sendResponse({ success: true, status: "getRules", rules: blackList });
      } else if (msg.action === 'deleteRule' && msg.deleteRuleId) {
        // delete single rule
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [msg.deleteRuleId],
          addRules: []
        })
          .then(() => {
            sendResponse({ success: true, status: "deletedRule", msg: `Rule ${msg.url} have been deleted` });
          })
          .finally(() => console.log(`Updated rules: ${blackList}`))
      }
    })
    .catch(error => sendResponse({ success: false, error })
    );
  return true;
});
