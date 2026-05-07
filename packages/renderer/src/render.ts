import puppeteer, { type Browser } from 'puppeteer';

export type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };
const MAX_CONCURRENT_RENDERS = 4;

let browserPromise: Promise<Browser> | null = null;
let active = 0;
const queue: Array<() => void> = [];

const acquire = (): Promise<void> => {
  if (active < MAX_CONCURRENT_RENDERS) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
};

const release = (): void => {
  const next = queue.shift();
  if (next) next();
  else active--;
};

const launchBrowser = async (): Promise<Browser> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  // If Chrome dies (crash, OOM), drop the cached promise so the next render
  // re-launches instead of awaiting a dead handle forever.
  browser.on('disconnected', () => {
    if (browserPromise) browserPromise = null;
  });
  return browser;
};

const getBrowser = (): Promise<Browser> => {
  if (!browserPromise) browserPromise = launchBrowser();
  return browserPromise;
};

export const render = async (
  html: string,
  viewport: Viewport = DEFAULT_VIEWPORT,
): Promise<Buffer> => {
  await acquire();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ deviceScaleFactor: 1, ...viewport });
      await page.setContent(html, { waitUntil: 'load' });
      const buf = await page.screenshot({ type: 'png', fullPage: false });
      return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    } finally {
      await page.close();
    }
  } finally {
    release();
  }
};

export const closeRenderer = async (): Promise<void> => {
  if (!browserPromise) return;
  const promise = browserPromise;
  browserPromise = null;
  const browser = await promise;
  await browser.close();
};
