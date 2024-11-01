export const storageKey = 'urlRules';
export const storageRulesKey = 'inactiveRules';
export const storageStrictModeKey = 'strictMode';
export const forbiddenUrls: RegExp[] = [
  /^chrome-extension:\/\//
];
// export const strictModeBlockPeriod = 1 * 60 * 60 * 1000; // 1h 
export const strictModeBlockPeriod = 1 * 10 * 1000; // 10s