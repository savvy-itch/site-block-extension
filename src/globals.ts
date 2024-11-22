export const storageKey = 'urlRules';
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
  // chrome: "https://chromewebstore.google.com/category/extensions",
  edge: "https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home?",
  firefox: "https://addons.mozilla.org/en-US/firefox/",
  opera: "https://addons.opera.com/en/extensions/"
};
