export const STORAGE_INACTIVE_RULES = 'inactiveRules';
export const STORAGE_STRICT_MODE = 'strictMode';
export const PREV_RESET_DATE = 'prevResetDate';
export const STORAGE_PREV_UPDATE_VERSION = 'prevUpdate';
export const FORBIDDEN_URLS: RegExp[] = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//
];
export const STRICT_MODE_BLOCK_PERIOD = 1 * 60 * 60 * 1000; // 1h
export const MIN_URL_LEN = 4;
export const MAX_URL_LEN = 75;
export const WEB_STORES_LIST = {
  chrome: "https://chromewebstore.google.com/detail/on-pace/kpniallfjagbbjigjigdlkoambcipoea?hl=en-US&utm_source=ext_sidebar",
  edge: "https://microsoftedge.microsoft.com/addons/detail/on-pace/oifamaadhbcefjhakfkojcomahfkchpi",
  firefox: "https://addons.mozilla.org/en-US/firefox/addon/on-pace/"
};
export const DEFAULT_DISABLE_LIMIT = 3;
// OS preference
export const DARK_PREF = '(prefers-color-scheme: dark)';
export const LIGHT_PREF = '(prefers-color-scheme: light)';