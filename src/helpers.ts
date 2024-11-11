import browser from 'webextension-polyfill';
import { DeleteAllAction, ResToSend } from "./types";

export function stripUrl(url: string): string {
  return url.replace(/^\^https\?:\/\//, '').replace(/\?\.\*|\?\$$/, '');
}

export async function deleteRules() {
  console.log('deleteRules()');
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
