import { assignStoreLink, getExtVersion } from "./helpers";

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

document.addEventListener('DOMContentLoaded', () => {
  if (versionElem) {
    versionElem.innerText = getExtVersion() ?? '';
  }
  if (webStoreLink) {
    assignStoreLink(webStoreLink);
  }
});
