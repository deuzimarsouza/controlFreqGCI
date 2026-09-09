// Optional browser regression check: requires Playwright and Microsoft Edge.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const project = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#installStatus').textContent === 'Disponível offline');
    assert.equal(await page.locator('#btnInstallApp, #installHelpDialog').count(), 0);
    assert.equal(await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }), false, 'The app must leave the browser native installation prompt available');
    assert.equal(await page.locator('#btnExportPdf').isDisabled(), true);
    assert.equal(await page.locator('#reportState').textContent(), 'Aguardando relatório');
    assert.equal(await page.locator('.empty').count(), 5);
    await page.screenshot({ path: path.join(project, '..', 'producao-gci-inicial.png'), fullPage: true });
    await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures', 'producao-sintetica.txt'));
    await page.waitForFunction(() => document.querySelector('#reportState').textContent === 'Totais conferidos');
    for (const [id, expected] of Object.entries({
      officialTotal: '2.100', totalFrequencia: '450', totalSpecial: '1.650', totalGeneral: '1.800',
      totalMizuno: '150', totalChuteiras: '80', totalUnderArmour: '70',
      generalTableTotal: '1.800'
    })) assert.equal(await page.locator('#' + id).textContent(), expected, id);
    assert.equal(await page.locator('#generalTable tr').count(), 4);
    for (const [id, extension, signature] of [
      ['btnExportPdf', '.pdf', '%PDF'], ['btnExportExcel', '.xlsx', 'PK']
    ]) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#' + id).click()]);
      assert.ok(download.suggestedFilename().endsWith(extension));
      const bytes = fs.readFileSync(await download.path());
      assert.ok(bytes.subarray(0, 4).toString().startsWith(signature));
    }
    await page.locator('#toastModal').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(project, '..', 'producao-gci-desktop.png'), fullPage: true });
    const cdp = await context.newCDPSession(page);
    const manifest = await cdp.send('Page.getAppManifest');
    assert.deepEqual(manifest.errors, []);
    console.log('Installability:', JSON.stringify(await cdp.send('Page.getInstallabilityErrors')));
    for (const width of [1920, 1366, 1024, 768, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overflow at ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(project, '..', 'producao-gci-mobile.png'), fullPage: true });
    await page.locator('#fileInput').setInputFiles({ name: 'invalido.txt', mimeType: 'text/plain', buffer: Buffer.from('sem producao') });
    await page.waitForFunction(() => document.querySelector('#reportState').textContent === 'Nenhuma linha válida');
    assert.equal(await page.locator('#btnExportPdf').isDisabled(), true);
    assert.match(await page.locator('#statusMessage').textContent(), /Nenhuma linha/);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => /^(Usando|Disponível) offline$/.test(document.querySelector('#installStatus').textContent));
    await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures', 'producao-sintetica.txt'));
    await page.waitForFunction(() => document.querySelector('#totalFrequencia').textContent === '450');
    for (const id of ['btnExportPdf', 'btnExportExcel']) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#' + id).click()]);
      assert.equal(await download.failure(), null);
    }
    // Network update failures while intentionally offline are expected.
    const unexpected = errors.filter(message => !message.includes('net::ERR_INTERNET_DISCONNECTED') && !message.includes('net::ERR_FAILED'));
    assert.deepEqual(unexpected, []);
    await context.close();
    const fileContext = await browser.newContext();
    const filePage = await fileContext.newPage();
    await filePage.goto(require('node:url').pathToFileURL(path.join(project, 'index.html')).href);
    assert.equal(await filePage.locator('#btnInstallApp, #installHelpDialog').count(), 0);
    await fileContext.close();
    console.log('PASS: import, totals, exports, 7 viewport widths, manifest, offline, no custom install UI in served/file mode, native prompt not canceled; no unexpected browser errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
