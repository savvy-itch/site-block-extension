import test, { BrowserContext, chromium, expect, Page } from "@playwright/test";
import { RuleInStorage } from "../src/types";

test.use({ browserName: 'chromium' });

let context: BrowserContext;
let page: Page;
let extensionId: string;


test.beforeAll(async () => {
  const pathToExtension = require('path').join(__dirname, '..', 'dist');

  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ],
  });

  page = await context.newPage();

  let [background] = context.serviceWorkers();
  if (!background)
    background = await context.waitForEvent('serviceworker');

  extensionId = background.url().split('/')[2];
});

test.afterAll(async () => {
  await context.close();
});

test('Open options page', async () => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Extension settings' })).toBeVisible();
});

test.describe.serial('Add URLs to block list', () => {
  test('Options page exists', async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await expect(urlInput).toBeVisible();
  });

  test('Add new URL to block list', async () => {
    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await page.keyboard.press('Enter');
    await page.waitForSelector('td.row-url', { state: 'visible' });
    expect(await page.locator('td.row-url').textContent()).toContain('example.com/');
  });

  test('Add duplicate URL to block list', async () => {
    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await page.keyboard.press('Enter');
    await expect(page.getByText('URL is already blocked', { exact: true })).toBeVisible();
  });

  test('URL from block list redirects to block page', async () => {
    await page.goto('https://example.com');
    await expect(page.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });
});

test.describe.serial('Edit rules', () => {
  test.beforeEach(async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Edit rule URL', async () => {
    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await page.keyboard.press('Enter');

    const editBtn = page.getByRole('button', { name: 'Edit URL button' });
    await editBtn.click();
    await expect(editBtn).toBeVisible();

    const editUrlInput = page.locator('.row-url input');
    await expect(editUrlInput).toBeVisible();
    await editUrlInput.fill('https://www.youtube.com/');

    const saveBtn = page.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await page.waitForTimeout(500);

    await page.waitForSelector('td.row-url', { state: 'visible' });
    expect(await page.locator('td.row-url').textContent()).toContain('www.youtube.com/');

    await page.goto('https://example.com');
    await expect(page.getByText('This page is blocked!', { exact: true })).not.toBeVisible();

    await page.goto('https://www.youtube.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });

  test('Allow subdomains', async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const editBtn = page.getByRole('button', { name: 'Edit URL button' });
    await editBtn.click();
    const editUrlInput = page.locator('.row-url input');
    await editUrlInput.fill('https://example.com');
    const domainCheckbox = page.locator('.domain-checkbox');
    await domainCheckbox.waitFor();
    await expect(domainCheckbox).toBeVisible();

    await domainCheckbox.click();
    const saveBtn = page.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await page.waitForTimeout(500);

    await page.goto('https://example.com/test/');
    await expect(page.getByText('This page is blocked!', { exact: true })).not.toBeVisible();

    await page.goto('https://example.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });

  test('Disable URL', async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const activeCheckbox = page.locator('.active-switch');
    await activeCheckbox.waitFor();
    await expect(activeCheckbox).toBeVisible();

    await activeCheckbox.click();
    const saveBtn = page.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await page.waitForTimeout(500);

    await page.goto('https://example.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).not.toBeVisible();
  });
});

test.describe('Delete rules', async () => {
  test.beforeEach(async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Delete single rule', async () => {
    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await page.keyboard.press('Enter');
    const dltBtn = page.getByTitle('delete URL button');
    await expect(dltBtn).toBeVisible();

    await dltBtn.click();
    const okBtn = page.getByRole('button', { name: /ok/i });
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    const noUrlsMsg = page.getByText('No URLs to block.');
    await noUrlsMsg.waitFor();
    await expect(noUrlsMsg).toBeVisible();
    await page.goto('https://example.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).not.toBeVisible();
  });

  test('Delete all rules', async () => {
    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com');
    await page.keyboard.press('Enter');

    const dltAllBtn = page.getByRole('button', { name: 'Delete all rules' });
    await expect(dltAllBtn).toBeVisible();

    await dltAllBtn.click();
    const okBtn = page.getByRole('button', { name: /ok/i });
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    const noUrlsMsg = page.getByText('No URLs to block.');
    await noUrlsMsg.waitFor();
    await expect(noUrlsMsg).toBeVisible();
    await page.goto('https://example.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).not.toBeVisible();
  });
});

test('Search list', async () => {
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

  expect(page.getByText('foo.com/')).toBeVisible();
  expect(page.getByText('bar.com')).not.toBeVisible();
});

test.describe('Strict mode works', () => {
  test.beforeEach(async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
  });

  test('Disabled rule re-enabled after 1 hour', async () => {
    await page.clock.install();
    const strictModeSwitch = page.locator('.strict-mode-switch');
    await expect(strictModeSwitch).toBeVisible();

    await strictModeSwitch.click();

    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://example.com/');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

  const activeCheckbox = page.locator('.active-switch');
  await activeCheckbox.waitFor();
  await activeCheckbox.click();
  const saveBtn = page.getByRole('button', { name: 'Save Changes' });
  await saveBtn.click();

    await page.waitForTimeout(500);

    await page.goto('https://example.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).not.toBeVisible();

    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.evaluate(async () => {
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

    await page.waitForFunction(async () => {
      return new Promise(resolve => {
        chrome.storage.local.get('inactiveRules', data => {
          resolve(data.inactiveRules && data.inactiveRules.length === 0);
        });
      });
    });

    await page.reload();
    await page.waitForTimeout(3000);
    expect(activeCheckbox.isChecked).toBeTruthy();
    await page.goto('https://example.com/');
    await expect(page.getByText('This page is blocked!', { exact: true })).toBeVisible();
  });

  test('Exceed daily disable limit', async () => {
    const strictModeSwitch = page.locator('.strict-mode-switch');
    await strictModeSwitch.click();

    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://foo.com/');
    await page.keyboard.press('Enter');
    await urlInput.fill('https://bar.com/');
    await page.keyboard.press('Enter');
    await urlInput.fill('https://baz.com/');
    await page.keyboard.press('Enter');
    await urlInput.fill('https://example.com/');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    const activeCheckboxes = page.locator('.active-switch');
    const count = await activeCheckboxes.count();

    for (let i = 0; i < count; i++) {
      await activeCheckboxes.nth(i).click();
    }

    await page.waitForTimeout(500);

    // the 4th URL won't disable as the daily limit is 3
    const lastCheckbox = page.locator('.active-checkbox').nth(3);
    await expect(lastCheckbox).toBeInViewport();
    expect(lastCheckbox.isChecked).toBeTruthy();
  });

  test('Reset daily limit', async () => {
    const strictModeSwitch = page.locator('.strict-mode-switch');
    await strictModeSwitch.click();

    const urlInput = page.getByLabel('Enter URL of the website you want to block:');
    await urlInput.fill('https://foo.com/');
    await page.keyboard.press('Enter');
    await urlInput.fill('https://bar.com/');
    await page.keyboard.press('Enter');
    await urlInput.fill('https://baz.com/');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    const activeCheckboxes = page.locator('.active-switch');
    const count = await activeCheckboxes.count();

    for (let i = 0; i < count; i++) {
      await activeCheckboxes.nth(i).click();
    }

    const saveBtn = page.getByRole('button', { name: 'Save Changes' });
    await saveBtn.click();

    await page.waitForTimeout(500);

    const limitCount = page.locator('#disable-limit');
    expect(await limitCount.textContent()).toEqual('0');

    const fakeYesterday = new Date();
    fakeYesterday.setDate(fakeYesterday.getDate() - 1);

    await page.evaluate(async (fakeYesterday) => {
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
    
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForTimeout(500);
    await page.reload();
    expect(await limitCount.textContent()).toEqual('3');
  });
});
