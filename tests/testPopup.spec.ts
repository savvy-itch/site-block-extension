import test, { chromium, expect, Locator } from "@playwright/test";
import path from "path";
import fs from 'fs';

test.use({ browserName: 'chromium' });

test('Open example.com and trigger the popup form', async () => {
  const pathToExtension = path.resolve(__dirname, '..', 'dist');
  const userDataDir = path.resolve(__dirname, '..', 'tmp-profile');

  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  const page = await browserContext.newPage();
  await page.goto('https://example.com');
  // await page.goto('https://www.toptal.com/developers/keycode');
  await page.waitForLoadState('networkidle');

  console.log('Browser launched...');

  // const triggerBtn = page.getByText('Trigger Extension');
  // await page.waitForSelector('#test-trigger-button')
  // await triggerBtn.click();
  await page.keyboard.press('Control+q');

  const popupForm = await page.getByLabel('extension-popup-form');
  await expect(popupForm).toBeVisible();
  await expect(popupForm).toHaveText('https://example.com');

  await popupForm.press('Enter');
  await expect(page).toHaveTitle('Blocked | On Pace Extension');

  await browserContext.close();
});
