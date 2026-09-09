// Optional check in a fresh regular Edge profile; no application is installed.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gci-installability-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true });
  try {
    const page = context.pages()[0];
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#installStatus').textContent === 'Disponível offline');
    assert.equal(await page.locator('#btnInstallApp, #installHelpDialog').count(), 0);
    assert.equal(await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }), false, 'The app must leave the browser native installation prompt available');
    const cdp = await context.newCDPSession(page);
    const manifest = await cdp.send('Page.getAppManifest');
    assert.deepEqual(manifest.errors, []);
    const result = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(result.installabilityErrors, []);
    console.log('PASS: no custom install UI, native prompt not canceled, and Edge regular profile reports no manifest or installability errors. No app installed.');
  } finally {
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
