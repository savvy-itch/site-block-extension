import { MsgToSend, ResToSend } from "./types";

const settingsSection = document.getElementById('settings-section');
const tbody = document.getElementById('url-table');

function displayUrlList() {
  const msg: MsgToSend = { action: 'getRules' };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      console.log(res?.rules);
    } else {
      alert('An error occured. Check the console.');
      console.error(res.error);
    }
  })
}

displayUrlList();
