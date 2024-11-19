import browser from 'webextension-polyfill';
import { AddAction, DeleteAllAction, ResToSend } from "./types";
import { forbiddenUrls, maxUrlLength, minUrlLength } from './globals';

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

export async function handleFormSubmission(urlForm: HTMLFormElement, errorPara: HTMLParagraphElement, successFn: Function) {
  if (urlForm && errorPara && successFn) {
    const formData = new FormData(urlForm);
    const urlToBlock = formData.get('url') as string;
    const blockDomain = (document.getElementById('block-domain') as HTMLInputElement).checked;

    // handle errors
    if (!urlToBlock || forbiddenUrls.some(url => url.test(urlToBlock))) {
      if (errorPara) {
        errorPara.textContent = 'Invalid URL';
      }
      console.error(`Invalid URL: ${urlToBlock}`);
      return;
    } else if (urlToBlock.length < minUrlLength) {
      if (errorPara) {
        errorPara.textContent = 'URL is too short';
      }
      console.error(`URL is too short`);
      return;
    } else if (urlToBlock.length > maxUrlLength) {
      if (errorPara) {
        errorPara.textContent = 'URL is too long';
      }
      console.error(`URL is too long`);
      return;
    }

    const msg: AddAction = { action: "blockUrl", url: urlToBlock, blockDomain };

    try {
      const res: ResToSend = await browser.runtime.sendMessage(msg);
      if (res.success) {
        if (res.status === 'added') {
          successFn();
        } else if (res.status === 'duplicate') {
          alert('URL is already blocked');
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}
