import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { GetAllAction, ResToSend } from '../src/types';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const EXTENSION_ID = 'oifpkgocngelpfigdacalnieefliaihb';

let browser: Browser | undefined;
let page: Page;

const mockRulesResponse: ResToSend = {
  success: true,
  rules: [
    { id: 1, url: '^https://example.com', strippedUrl: 'example.com/', blockDomain: true, isActive: true },
    { id: 2, url: '^http://another.com', strippedUrl: 'another.com/', blockDomain: false, isActive: false }
  ]
};

const mockSendMsg = jest.fn((msg, callback) => {
    if (msg.action === 'getRules') {
      callback(mockRulesResponse);
    }
  });

beforeAll(async () => {
  // global.chrome = {
  //   runtime: {
  //     sendMessage: mockSendMsg,
  //   }
  // }

  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_ID}`
    ]
  });

  page = await browser?.newPage();
  await page?.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
});

afterAll(async () => {
  await browser?.close();
  browser = undefined;
});

test('options page renders', async () => {
  const page = await browser?.newPage();
  await page?.goto(`chrome-extension://${EXTENSION_ID}/options.html`);

  const section = await page?.$('#settings-section');
  expect(section).not.toBeNull()
});

test('url list renders', async () => {
  await page.evaluate(() => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  await page.waitForSelector('#url-table tr');

  const rows = await page.$$eval('#url-table tr', rows => rows.length);
  expect(rows).toBe(2);

  const firstRuleUrl = await page.$eval(`#row-${mockRulesResponse.rules![0].id} .row-url`, el => el.textContent);
  const secondRuleUrl = await page.$eval(`#row-${mockRulesResponse.rules![1].id} .row-url`, el => el.textContent);

  expect(firstRuleUrl).toBe('example.com/');
  expect(secondRuleUrl).toBe('another.com/');
});
