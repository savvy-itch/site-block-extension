import { expect, test, vi } from 'vitest';
import { separateUniqueFromDuplicates } from './dataTransfer';
import { Site } from './types';

vi.mock("webextension-polyfill", () => ({
  default: {}
}));

test("Separates unique items from duplicates", () => {
  const importedRules: Site[] = [
    {
      id: 1,
      url: "^https?://example.com/?.*",
      strippedUrl: "example.com/",
      blockDomain: true,
      isActive: true
    },
    {
      id: 2,
      url: "^https?://duplicate.com/?.*",
      strippedUrl: "duplicate.com/",
      blockDomain: true,
      isActive: true
    },
    {
      id: 3,
      url: "^https?://duplicate2.com/?.*",
      strippedUrl: "duplicate2.com/",
      blockDomain: true,
      isActive: true
    }
  ];
  const cachedRules: Site[] = [
    {
      id: 3,
      url: "^https?://duplicate2.com/?.*",
      strippedUrl: "duplicate2.com/",
      blockDomain: true,
      isActive: true
    },
    {
      id: 2,
      url: "^https?://duplicate.com/?.*",
      strippedUrl: "duplicate.com/",
      blockDomain: true,
      isActive: true
    },
    {
      id: 4,
      url: "^https?://example4.com/?.*",
      strippedUrl: "example4.com/",
      blockDomain: true,
      isActive: true
    }
  ];
  const { uniqueRules, duplicates } = separateUniqueFromDuplicates(importedRules, cachedRules);
  expect(uniqueRules.length).toBe(1);
  expect(duplicates.length).toBe(2);
});