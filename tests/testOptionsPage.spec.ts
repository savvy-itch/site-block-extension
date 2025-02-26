import test, { BrowserContext, chromium, expect, Locator, Page } from "@playwright/test";
import { RuleInStorage } from "../src/types";

test.use({ browserName: 'chromium' });

let globalContext: BrowserContext | null = null;
let page: Page;
let extensionId: string;

const pathToExtension = require('path').join(__dirname, '..', 'dist');

async function createContext() {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ],
  });

  const page = await context.newPage();

  let [background] = context.serviceWorkers();
  if (!background)
    background = await context.waitForEvent('serviceworker');

  extensionId = background.url().split('/')[2];

  return { context, page };
}

test.beforeEach(async ({}, testInfo) => {
  if (!testInfo.title.includes('describe')) {
    const { context, page } = await createContext();
    globalContext = context;
  }
});

test.afterEach(async ({}, testInfo) => {
  if (!testInfo.title.includes('describe') && globalContext) {
    await globalContext.close();
    globalContext = null;
  }
});

test('Open options page', async () => {
  if (!globalContext) throw new Error('Context was not initialized');
  const page = await globalContext.newPage();

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Extension settings' })).toBeVisible();
});

test.describe.serial('Add URLs to block list', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async () => {
    const { context, page } = await createContext();
    sharedContext = context;
    sharedPage = page;
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test('Options page exists', async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);
    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await expect(urlInput).toBeVisible();
  });

  test('Add new URL to block list', async () => {
    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await sharedPage.keyboard.press('Enter');
    await sharedPage.waitForSelector('td.row-url', { state: 'visible' });
    expect(await sharedPage.locator('td.row-url').textContent()).toContain('example.com/');
  });

  test('Add duplicate URL to block list', async () => {
    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await sharedPage.keyboard.press('Enter');
    await expect(sharedPage.getByText('URL is already blocked', { exact: true })).toBeVisible();
  });

  test('URL from block list redirects to block page', async () => {
    await sharedPage.goto('https://example.com');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });
});

test.describe.serial('Edit rules', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async () => {
    const { context, page } = await createContext();
    sharedContext = context;
    sharedPage = page;
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test.beforeEach(async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Edit rule URL', async () => {
    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await sharedPage.keyboard.press('Enter');

    const editBtn = sharedPage.getByRole('button', { name: 'Edit URL button' });
    await editBtn.click();
    await expect(editBtn).toBeVisible();

    const editUrlInput = sharedPage.locator('.row-url input');
    await expect(editUrlInput).toBeVisible();
    await editUrlInput.fill('https://www.youtube.com/');

    const saveBtn = sharedPage.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await sharedPage.waitForTimeout(500);

    await sharedPage.waitForSelector('td.row-url', { state: 'visible' });
    expect(await sharedPage.locator('td.row-url').textContent()).toContain('www.youtube.com/');

    await sharedPage.goto('https://example.com');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).not.toBeVisible();

    await sharedPage.goto('https://www.youtube.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });

  test('Allow subdomains', async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);

    const editBtn = sharedPage.getByRole('button', { name: 'Edit URL button' });
    await editBtn.click();
    const editUrlInput = sharedPage.locator('.row-url input');
    await editUrlInput.fill('https://example.com');
    const domainCheckbox = sharedPage.locator('.domain-checkbox');
    await domainCheckbox.waitFor();
    await expect(domainCheckbox).toBeVisible();

    await domainCheckbox.click();
    const saveBtn = sharedPage.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await sharedPage.waitForTimeout(500);

    await sharedPage.goto('https://example.com/test/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).not.toBeVisible();

    await sharedPage.goto('https://example.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });

  test('Disable URL', async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);

    const activeCheckbox = sharedPage.locator('.active-switch');
    await activeCheckbox.waitFor();
    await expect(activeCheckbox).toBeVisible();

    await activeCheckbox.click();
    const saveBtn = sharedPage.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await sharedPage.waitForTimeout(500);

    await sharedPage.goto('https://example.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).not.toBeVisible();
  });
});

test.describe('Delete rules', async () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async () => {
    const { context, page } = await createContext();
    sharedContext = context;
    sharedPage = page;
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test.beforeEach(async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Delete single rule', async () => {
    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await sharedPage.keyboard.press('Enter');
    const dltBtn = sharedPage.getByTitle('delete URL button');
    await expect(dltBtn).toBeVisible();

    await dltBtn.click();
    const okBtn = sharedPage.getByRole('button', { name: /ok/i });
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    const noUrlsMsg = sharedPage.getByText('No URLs to block.');
    await noUrlsMsg.waitFor();
    await expect(noUrlsMsg).toBeVisible();
    await sharedPage.goto('https://example.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).not.toBeVisible();
  });

  test('Delete all rules', async () => {
    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await sharedPage.keyboard.press('Enter');

    const dltAllBtn = sharedPage.getByRole('button', { name: 'Delete all rules' });
    await expect(dltAllBtn).toBeVisible();

    await dltAllBtn.click();
    const okBtn = sharedPage.getByRole('button', { name: /ok/i });
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    const noUrlsMsg = sharedPage.getByText('No URLs to block.');
    await noUrlsMsg.waitFor();
    await expect(noUrlsMsg).toBeVisible();
    await sharedPage.goto('https://example.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).not.toBeVisible();
  });
});

test('Search list', async () => {
  if (!globalContext) throw new Error('Context was not initialized');
  const page = await globalContext.newPage();

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const urlInput = page.getByLabel('Enter URL of the website you want to block:');
  const testUrl = 'https://foo.com';
  await urlInput.fill(testUrl);
  await page.keyboard.press('Enter');
  await urlInput.fill('https://bar.com');
  await page.keyboard.press('Enter');

  const searchInput = page.getByPlaceholder('Search URLs');
  await expect(searchInput).toBeVisible();

  await searchInput.fill('foo');

  await page.waitForTimeout(500);

  await expect(page.getByText('foo.com/')).toBeVisible();
  await expect(page.getByText('bar.com/')).not.toBeVisible();
});

test.describe('Strict mode works', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async () => {
    const { context, page } = await createContext();
    sharedContext = context;
    sharedPage = page;
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test.beforeEach(async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Disabled rule re-enabled after 1 hour', async () => {
    await sharedPage.clock.install();
    const strictModeSwitch = sharedPage.locator('.strict-mode-switch');
    await expect(strictModeSwitch).toBeVisible();

    await strictModeSwitch.click();

    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com/');
    await sharedPage.keyboard.press('Enter');

    await sharedPage.waitForTimeout(500);

    const activeCheckbox = sharedPage.locator('.active-switch');
    await activeCheckbox.waitFor();
    await activeCheckbox.click();
    const saveBtn = sharedPage.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await sharedPage.waitForTimeout(500);

    await sharedPage.goto('https://example.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).not.toBeVisible();

    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);

    await sharedPage.evaluate(async () => {
      await new Promise<void>(resolve => {
        chrome.storage.local.get('inactiveRules', (data) => {
          if (data.inactiveRules) {
            const updatedRules: RuleInStorage[] = data.inactiveRules.map((rule: RuleInStorage) => ({
              ...rule,
              unblockDate: Date.now() - 360000 // Set past timestamp
            }));

            chrome.storage.local.set({ inactiveRules: updatedRules }, resolve);
          } else {
            resolve();
            console.log('no such key in storage');
          }
        });
      });
    });

    await sharedPage.waitForFunction(async () => {
      return new Promise(resolve => {
        chrome.storage.local.get('inactiveRules', data => {
          resolve(data.inactiveRules && data.inactiveRules.length === 0);
        });
      });
    });

    await sharedPage.reload();
    await sharedPage.waitForTimeout(3000);
    expect(activeCheckbox.isChecked).toBeTruthy();
    await sharedPage.goto('https://example.com/');
    await expect(sharedPage.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });

  test('Exceed daily disable limit', async () => {
    const strictModeSwitch = sharedPage.locator('.strict-mode-switch');
    await strictModeSwitch.click();

    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://foo.com/');
    await sharedPage.keyboard.press('Enter');
    await urlInput.fill('https://bar.com/');
    await sharedPage.keyboard.press('Enter');
    await urlInput.fill('https://baz.com/');
    await sharedPage.keyboard.press('Enter');
    await urlInput.fill('https://example.com/');
    await sharedPage.keyboard.press('Enter');

    await sharedPage.waitForTimeout(500);

    const activeCheckboxes = sharedPage.locator('.active-switch');
    const count = await activeCheckboxes.count();

    for (let i = 0; i < count; i++) {
      await activeCheckboxes.nth(i).click();
    }

    await sharedPage.waitForTimeout(500);

    // the 4th URL won't disable as the daily limit is 3
    const lastCheckbox = sharedPage.locator('.active-checkbox').nth(3);
    await expect(lastCheckbox).toBeInViewport();
    expect(lastCheckbox.isChecked).toBeTruthy();
  });

  test('Reset daily limit', async () => {
    const strictModeSwitch = sharedPage.locator('.strict-mode-switch');
    await strictModeSwitch.click();

    const urlInput = sharedPage.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://foo.com/');
    await sharedPage.keyboard.press('Enter');
    await urlInput.fill('https://bar.com/');
    await sharedPage.keyboard.press('Enter');
    await urlInput.fill('https://baz.com/');
    await sharedPage.keyboard.press('Enter');

    await sharedPage.waitForTimeout(500);

    const activeCheckboxes = sharedPage.locator('.active-switch');
    const count = await activeCheckboxes.count();

    for (let i = 0; i < count; i++) {
      await activeCheckboxes.nth(i).click();
    }

    const saveBtn = sharedPage.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await sharedPage.waitForTimeout(500);

    const limitCount = sharedPage.locator('#disable-limit');
    expect(await limitCount.textContent()).toEqual('0');

    const fakeYesterday = new Date();
    fakeYesterday.setDate(fakeYesterday.getDate() - 1);

    await sharedPage.evaluate(async (fakeYesterday) => {
      await new Promise<void>(resolve => {
        chrome.storage.local.get('prevResetDate', (data) => {
          if (data.prevResetDate) {
            chrome.storage.local.set({ prevResetDate: fakeYesterday.toISOString() }, resolve);
          } else {
            resolve();
            console.log('no such key in storage');
          }
        });
      });
    }, fakeYesterday);

    await sharedPage.waitForTimeout(3000);
    await sharedPage.reload();
    await expect(await limitCount.textContent()).toEqual('3');
  });
});

async function waitForAnimationEnd(locator: Locator) {
	const handle = await locator.elementHandle();
	await handle?.waitForElementState('stable');
	handle?.dispose();
}

test.describe('Update popup works', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async () => {
    const { context, page } = await createContext();
    sharedContext = context;
    sharedPage = page;
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test.beforeEach(async () => {
    await sharedPage.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Popup appears with new update', async () => {
    const popup = sharedPage.getByText('Your extension has received a new update');
    await expect(popup).toBeVisible();
  });

  test('Popup doesn\'t appear after closing the popup', async () => {
    const popup = sharedPage.locator('.extension-update-popup');
    const closeBtn = sharedPage.getByRole('button', { name: 'close popup' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await waitForAnimationEnd(popup);
    await expect(popup).toBeHidden();
    await sharedPage.reload();
    await expect(popup).toBeHidden();
  });
});
