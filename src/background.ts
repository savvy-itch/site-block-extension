import { NewRule, ResToSend, Site } from "./types";

/*
  + handle form submission
  + check the current tab URL for blocked ones
  - display custom UI if the website is blocked
  ! options page
    - display list of rules
    - allow rule edit/delete
  - add regex to form (specific URl/the whole domain blocking toggle);
  - remove form after successful submission
  - add permanent/temporary block option
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
          files: ['./dist/content.js'],
        })
      })
      .catch(error => console.error(error));
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse: (response: ResToSend) => void) => {
  chrome.declarativeNetRequest.getDynamicRules()
    .then(existingRules => {
      const blackList: Site[] = existingRules.map(rule => ({
        id: rule.id.toString(),
        url: rule.condition.urlFilter as string
      }));
      console.log({ blackList });

      // form submission
      if (msg.action === 'blockUrl') {
        const urlToBlock = msg.url;
        if (blackList.some(site => site.url === `*://${urlToBlock}/*`)) {
          console.log('This URL is already in the list');
          sendResponse({ success: true, status: "duplicate", msg: 'URL is already blocked' });
          return;
        }

        const newRule: NewRule = {
          id: existingRules.length + 1,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: {
              url: chrome.runtime.getURL("blocked.html")
            }
          },
          condition: {
            urlFilter: `*://${urlToBlock}/*`,
            resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType]
          }
        };

        console.log(`Redirect URL: ${chrome.runtime.getURL("blocked.html")}`);

        chrome.declarativeNetRequest.updateDynamicRules({
          addRules: [newRule],
          removeRuleIds: []
        })
        .then(() => {
          sendResponse({ success: true, status: "added", msg: 'URL has been saved' });
        })
        .catch(error => sendResponse({ success: false, error }))
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
        .catch(error => sendResponse({ success: false, error }))
        .finally(() => console.log(`Updated rules: ${blackList}`))
      } else if (msg.action === 'getRules') {
        sendResponse({ success: true, status: "getRules", rules: blackList });
      }
    })
    .catch(error => sendResponse({ success: false, error })
    );
  return true;
});
