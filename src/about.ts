import { assignStoreLink, getExtVersion } from "./helpers";
import browser from 'webextension-polyfill';
import { Theme } from "./types";
import { DARK_PREF } from "./globals";

const body = document.querySelector('body') as HTMLBodyElement;
const links = document.querySelectorAll<HTMLAnchorElement>('.sublink');
const versionElem = document.getElementById('ext-version');
const webStoreLink = document.getElementById('web-store-link') as HTMLAnchorElement;

links.forEach(s => {
  s.addEventListener('click', (e) => {
    e.preventDefault();
    const section = document.querySelector(s.hash);
      section?.scrollIntoView({
        behavior: 'smooth'
      });
  })
});

document.addEventListener('DOMContentLoaded', async () => {
  const record = await browser.storage.local.get('darkMode');
  const persistedTheme = record.darkMode;
  const prefersDark = window.matchMedia(DARK_PREF).matches;
  if (persistedTheme === Theme.Dark || persistedTheme === Theme.Light) {
    body?.setAttribute('data-theme', persistedTheme);
  } else if (prefersDark) {
    body?.setAttribute('data-theme', Theme.Dark);
  } else {
    body?.setAttribute('data-theme', Theme.Light);
  }

  if (versionElem) {
    versionElem.innerText = getExtVersion() ?? '';
  }
  if (webStoreLink) {
    assignStoreLink(webStoreLink);
  }
});
