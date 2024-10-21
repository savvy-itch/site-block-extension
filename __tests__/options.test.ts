import puppeteer, { Browser } from 'puppeteer';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const EXTENSION_ID = 'oifpkgocngelpfigdacalnieefliaihb';

let browser: Browser | undefined;

beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_ID}`
    ]
  });
});

afterEach(async () => {
  await browser?.close();
  browser = undefined;
});

test('options page renders', async () => {
  const page = await browser?.newPage();
  await page?.goto(`chrome-extension://${EXTENSION_ID}/options.html`);

  const section = await page?.$('#settings-section');
  expect(section).not.toBeNull()
});
