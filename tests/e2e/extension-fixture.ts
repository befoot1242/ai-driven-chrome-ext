// @trace TS-001 TS-002 TS-003 TS-004
import { chromium, test as base, type BrowserContext } from "@playwright/test";
import { resolve } from "node:path";

type ExtensionFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({}, use) => {
    const extensionPath = resolve("dist");
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      await use(context);
    } finally {
      await context.close();
    }
  },

  extensionId: async ({ extensionContext }, use) => {
    const worker =
      extensionContext.serviceWorkers()[0] ??
      (await extensionContext.waitForEvent("serviceworker"));
    await use(new URL(worker.url()).host);
  },
});

export { expect } from "@playwright/test";
