import browser from 'webextension-polyfill';
import { AddAction, DeleteAllAction, ResToSend } from "./types";
import { forbiddenUrls, maxUrlLength, minUrlLength, webStores } from './globals';

/*
Brave:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
Chrome:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
Opera:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0'
Firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
Edge:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
*/

export function assignStoreLink(webStoreLink: HTMLAnchorElement) {
  const browser = navigator.userAgent;
  if (browser.includes('OPR/')) {
    webStoreLink.href = webStores.opera;
  } else if (browser.includes('Firefox/')) {
    webStoreLink.href = webStores.firefox;
  } else if (browser.includes('Edg/')) {
    webStoreLink.href = webStores.edge;
  } else {
    webStoreLink.href = webStores.chrome;
  }
}

export function getExtVersion() {
  const v = browser.runtime.getManifest().version;
  return v;
}

export function stripUrl(url: string): string {
  return url.replace(/^\^https\?:\/\//, '').replace(/\?\.\*|\?\$$/, '');
}

export async function deleteRules() {
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
