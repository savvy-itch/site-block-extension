import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const EXTENSION_ID = 'oifpkgocngelpfigdacalnieefliaihb';

let browser: Browser | undefined;
let page: Page;

beforeEach(async () => {
  // jest.setTimeout(10000);
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_ID}`
    ]
  });

  // chrome-extension://oifpkgocngelpfigdacalnieefliaihb/options.html
  page = await browser.newPage();
  await page.goto('about:blank');
});

afterEach(async () => {
  await browser?.close();
  browser = undefined;
});

test('popup renders correctly on icon click', async () => {
  const serviceWorkerTarget = await browser?.waitForTarget(
    target => target.type() === 'service_worker'
      && target.url().endsWith('background.js')
  );

  if (!serviceWorkerTarget) {
    throw new Error('Service worker not found');
  }

  const worker = await serviceWorkerTarget.worker();
  // await worker?.evaluate(() => chrome.action.onClicked.dispatch());
  const form = await page.waitForSelector('#popup-form')
  expect(form).not.toBeNull()
});
