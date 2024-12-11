# On Pace 
<p align="center">
  <a rel="noreferrer noopener" href="https://chromewebstore.google.com/detail/on-pace/kpniallfjagbbjigjigdlkoambcipoea?hl=en-US&utm_source=ext_sidebar">
    <img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome-141e24.svg?&style=for-the-badge&logo=google-chrome&logoColor=white">
  </a>  
  <a rel="noreferrer noopener" href="https://addons.mozilla.org/en-US/firefox/addon/on-pace/">
    <img alt="Firefox Add-ons" src="https://img.shields.io/badge/Firefox-141e24.svg?&style=for-the-badge&logo=firefox-browser&logoColor=white">
  </a>
  <a rel="noreferrer noopener" href="https://microsoftedge.microsoft.com/addons/detail/on-pace/oifamaadhbcefjhakfkojcomahfkchpi">
    <img alt="Edge Addons" src="https://img.shields.io/badge/Edge-141e24.svg?&style=for-the-badge&logo=microsoft-edge&logoColor=white">
  </a>
</p>

On Pace is a cross-browser extension for blocking websites.

## Functionality
- users can add/edit/delete websites to blacklist to restrain access to them.
- "Block subdomains" feature allows to choose between blocking the entire domain or blocking a specific URL.
- users can disable URLs from the blacklist to regain access to them without deleting them.
- "Strict mode" feature adds an additional layer of restriction for users who require a more rigid control over their internet browsing. With strict mode enabled, any disabled URLs will be automatically reenabled in 1 hour.

## How to use it
To start the extension, simply click on its icon in your browser or use `Ctrl+Q` keyboard shortcut.

## Setup
Install the dependencies by running:

```
npm install
```

To compile the extension, run:

For Chrome:

```
npm run build:chrome
```

For Firefox:

``` 
npm run build:firefox
```