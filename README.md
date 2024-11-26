# On Pace 
On Pace is a cross-browser extension for blocking websites. It supports Chromium based browsers as well as Firefox. At the moment the extension is available in these web stores:

[to be added]

## Functionality
- users can add/edit/delete websites to blacklist to restrain access to them.
- "Block subdomains" feature allows to choose between blocking the entire domain or blocking a specific URL.
- users can disable URLs from the blacklist to regain access to them without deleting them.
- "Strict mode" feature adds an additional layer of restriction for users who require a more rigid control over their internet browsing. With strict mode enabled, any disabled URLs will be automatically reenabled in 1 hour.

## How to use it
To start the extension, simply click on its icon in your browser or use `Ctrl+Q` keyboard shortcut.

## Setup
The extension was built using Windows 10.

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