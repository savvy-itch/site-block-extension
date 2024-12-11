export const storageRulesKey = 'inactiveRules';
export const storageStrictModeKey = 'strictMode';
export const forbiddenUrls: RegExp[] = [
  /^chrome-extension:\/\//
];
export const strictModeBlockPeriod = 1 * 60 * 60 * 1000; // 1h 
// export const strictModeBlockPeriod = 1 * 10 * 1000; // 10s
export const minUrlLength = 4;
export const maxUrlLength = 75;
export const webStores = {
  chrome: "https://chromewebstore.google.com/detail/on-pace/kpniallfjagbbjigjigdlkoambcipoea?hl=en-US&utm_source=ext_sidebar",
  edge: "https://microsoftedge.microsoft.com/addons/detail/on-pace/oifamaadhbcefjhakfkojcomahfkchpi",
  firefox: "https://addons.mozilla.org/en-US/firefox/addon/on-pace/",
  opera: "https://addons.opera.com/en/extensions/"
};
