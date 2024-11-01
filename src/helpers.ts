import { DeleteAllAction, ResToSend } from "./types";

export function stripUrl(url: string): string {
  return url.replace(/^\^https\?:\/\//, '').replace(/\.\*|\$$/, '');
}

export function deleteRules() {
  const msg: DeleteAllAction = { action: 'deleteAll' };
  chrome.runtime.sendMessage(msg, (res: ResToSend) => {
    if (res.success) {
      alert('All rules have been deleted');
    } else {
      alert('An error occured. Check the console.');
      console.error(res.error);
    }
  })
}
