import type { Page } from '@playwright/test';

/**
 * Polyfill for Map.prototype.getOrInsertComputed (TC39 stage 3, Chrome 143+).
 * Required because pdfjs-dist >=5.5 uses this method, and the Playwright
 * chromium build may ship an older engine that lacks it.
 */
export const mapGetOrInsertComputedPolyfill = `
if (typeof Map.prototype.getOrInsertComputed !== 'function') {
  Map.prototype.getOrInsertComputed = function(key, callbackFn) {
    if (this.has(key)) return this.get(key);
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}
`;

/**
 * Install the polyfill in both the main page context and in web workers.
 * For workers we intercept the worker .mjs script and prepend the polyfill.
 */
export async function installPolyfills(page: Page) {
  // Main-frame polyfill
  await page.addInitScript(mapGetOrInsertComputedPolyfill);

  // Intercept the pdfjs worker script and prepend the polyfill
  await page.route(/pdf\.worker.*\.mjs/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body: mapGetOrInsertComputedPolyfill + '\n' + body,
    });
  });
}
