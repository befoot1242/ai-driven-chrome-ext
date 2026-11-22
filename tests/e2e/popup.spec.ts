// @trace TS-001
// 拡張機能を読み込んだ Chromium で popup を開く E2E テストのひな形。
// 事前に `npm run build` で dist/ を作成しておくこと。
import { test as base, chromium, expect, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve(__dirname, '../../dist');

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker.url().split('/')[2] ?? '');
  },
});

test('TS-001 popup で +1 を押すとカウントが増える', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(page.getByTestId('count')).toHaveText('0');
  await page.getByTestId('increment').click();
  await expect(page.getByTestId('count')).toHaveText('1');
});
