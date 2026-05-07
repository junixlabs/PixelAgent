import puppeteer, { type Browser } from 'puppeteer';

export type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

let browserPromise: Promise<Browser> | null = null;

const getBrowser = (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
};

export const render = async (
  html: string,
  viewport: Viewport = { width: 1440, height: 900 },
): Promise<Buffer> => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ deviceScaleFactor: 1, ...viewport });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buf = await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  } finally {
    await page.close();
  }
};

export const closeRenderer = async (): Promise<void> => {
  if (!browserPromise) return;
  const promise = browserPromise;
  browserPromise = null;
  const browser = await promise;
  await browser.close();
};
