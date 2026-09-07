// Browser regression check: NODE_PATH must expose Playwright; requires Edge.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const project = process.env.GCI_PROJECT_DIR || path.resolve(__dirname, '..');
const tableIds = ['generalTable', 'specialTable', 'mizunoTable', 'chuteiraTable', 'underArmourTable'];
const prefixes = ['CABEDAL INTUIT', 'CABEDAL MZ WAVE TESTE', 'CAB. CH. CAMPO TESTE', 'CABEDAL UA CHARGED TESTE'];

function report(itemCount) {
  const rows = ['RELATORIO SINTETICO — TESTE DE ROLAGEM'];
  for (let group = 0; group < prefixes.length; group += 1) {
    for (let index = 0; index < itemCount; index += 1) {
      const description = `${prefixes[group]} AZUL MODELO ${index + 1}${index % 2 === 0 ? ' DESCRICAO LONGA COM ACABAMENTO EM TECIDO RESPIRAVEL E DETALHES VERDES PARA CONFERENCIA INTEGRAL' : ''}`;
      rows.push(`MT CAB${group}${String(index + 1).padStart(2, '0')} ${description} ${(itemCount - index) * 10}`);
    }
  }
  rows.push(`TOTAL : ${4 * itemCount * (itemCount + 1) * 5}`);
  return rows.join('\n');
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function importReport(page, count, label) {
  await page.locator('#fileInput').setInputFiles({
    name: `rolagem-${label}.txt`, mimeType: 'text/plain', buffer: Buffer.from(report(count))
  });
  await page.waitForFunction(expected =>
    document.querySelector('#fileInput').value === ''
    && document.querySelectorAll('#generalTable tr:not(:has(.empty))').length === expected, count);
  await settle(page);
}

async function measure(page) {
  return page.locator('.production-grid .panel').evaluateAll(panels => panels.map(panel => {
    const wrap = panel.querySelector('.table-wrap');
    const rows = [...wrap.querySelectorAll('tbody tr')];
    const bounds = wrap.getBoundingClientRect();
    const head = wrap.querySelector('thead').getBoundingClientRect();
    const descriptions = rows.filter(row => !row.querySelector('.empty')).map(row => {
      const cell = row.cells[1];
      const style = getComputedStyle(cell);
      return { text: cell.textContent, whiteSpace: style.whiteSpace, height: cell.clientHeight,
        lineHeight: parseFloat(style.lineHeight), clipped: cell.scrollWidth > cell.clientWidth + 1 };
    });
    const panelBounds = panel.getBoundingClientRect();
    const summary = panel.querySelector('.panel-summary').getBoundingClientRect();
    return {
      id: wrap.querySelector('tbody').id,
      count: rows.filter(row => !row.querySelector('.empty')).length,
      total: panel.querySelector('.item-total strong').textContent,
      scrollTop: wrap.scrollTop, scrollHeight: wrap.scrollHeight, clientHeight: wrap.clientHeight,
      wrapTop: bounds.top + wrap.clientTop, wrapBottom: bounds.top + wrap.clientTop + wrap.clientHeight,
      headerBottom: head.bottom, overflow: getComputedStyle(wrap).overflowY,
      summaryFits: summary.left >= panelBounds.left && summary.right <= panelBounds.right && summary.bottom <= bounds.top + 1,
      rows: rows.map(row => { const rect = row.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; }),
      descriptions, empty: Boolean(wrap.querySelector('.empty'))
    };
  }));
}

function verifyCounts(metrics, count) {
  assert.deepEqual(metrics.map(panel => panel.id), tableIds);
  for (const panel of metrics) {
    assert.equal(panel.count, count, `${panel.id}: all item rows retained`);
    assert.equal(panel.total, String(count * (count + 1) * 5), `${panel.id}: full quantity total`);
    assert.equal(panel.rows.length, count || 1, `${panel.id}: all rows retained`);
    assert.equal(panel.summaryFits, true, `${panel.id}: total fits outside scroller`);
  }
}

function verifyFirstFour(metrics, label) {
  for (const panel of metrics) {
    const hint = `${label}/${panel.id}`;
    assert.equal(panel.scrollTop, 0, `${hint}: starts at first row`);
    assert.ok(panel.rows[0].top >= panel.headerBottom - 1, `${hint}: first row below header`);
    assert.ok(panel.rows[3].bottom <= panel.wrapBottom + 1.1, `${hint}: fourth row fully visible`);
    assert.ok(panel.rows[4].top >= panel.wrapBottom - 1.1, `${hint}: fifth row below viewport`);
    assert.ok(Math.abs(panel.rows[3].bottom - panel.wrapBottom) <= 1.1, `${hint}: viewport ends at fourth row`);
    assert.ok(panel.scrollHeight > panel.clientHeight, `${hint}: remaining rows scroll`);
    assert.match(panel.overflow, /^(auto|scroll)$/, `${hint}: scrolling enabled`);
    assert.ok(panel.descriptions.some(cell => cell.height > cell.lineHeight * 3), `${hint}: long text wraps`);
    for (const cell of panel.descriptions) {
      assert.notEqual(cell.whiteSpace, 'nowrap', `${hint}: wrapping preserved`);
      assert.equal(cell.clipped, false, `${hint}: description not clipped horizontally`);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const pageErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(pathToFileURL(path.join(project, 'index.html')).href);
    await settle(page);
    assert.equal(await page.locator('.item-count').count(), 0, 'item count badges removed');
    verifyCounts(await measure(page), 0);
    assert.equal(await page.locator('.production-grid .empty').count(), 5);

    await importReport(page, 8, 'muitos');
    for (const width of [1920, 1440, 1024, 768, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await settle(page);
      const metrics = await measure(page);
      verifyCounts(metrics, 8);
      verifyFirstFour(metrics, `${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `page width ${width}`);
    }

    await page.locator('.table-wrap').evaluateAll(wraps => wraps.forEach(wrap => { wrap.scrollTop = wrap.scrollHeight; }));
    await settle(page);
    let metrics = await measure(page);
    verifyCounts(metrics, 8);
    for (const panel of metrics) {
      assert.ok(panel.scrollTop > 0, `${panel.id}: scrolled`);
      assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${panel.id}: last row reachable`);
      assert.ok(panel.rows.at(-1).top >= panel.headerBottom - 1.1, `${panel.id}: last row visible below sticky header`);
    }
    await importReport(page, 8, 'reimportado');
    verifyFirstFour(await measure(page), 'reimport');

    await page.emulateMedia({ media: 'print' });
    await settle(page);
    metrics = await measure(page);
    verifyCounts(metrics, 8);
    for (const panel of metrics) {
      assert.equal(panel.overflow, 'visible', `${panel.id}: print exposes all rows`);
      assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${panel.id}: print includes last row`);
    }
    assert.ok((await page.pdf({ format: 'A4', printBackground: true })).length > 1000, 'print generates a PDF');
    await page.emulateMedia({ media: 'screen' });
    await settle(page);
    verifyFirstFour(await measure(page), 'after print');

    await importReport(page, 5, 'limite-com-rolagem');
    verifyCounts(await measure(page), 5);
    verifyFirstFour(await measure(page), 'five items');

    for (const count of [4, 3, 0]) {
      await importReport(page, count, `${count}-itens`);
      metrics = await measure(page);
      verifyCounts(metrics, count);
      for (const panel of metrics) {
        assert.equal(panel.scrollTop, 0, `${panel.id}/${count}: scroll reset`);
        assert.ok(panel.scrollHeight <= panel.clientHeight + 1, `${panel.id}/${count}: no unnecessary vertical scroll`);
        assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${panel.id}/${count}: all content visible`);
        assert.equal(panel.empty, count === 0, `${panel.id}/${count}: empty-state handling`);
      }
    }
    assert.deepEqual(pageErrors, [], 'no JavaScript errors');
    console.log('PASS: four fully visible rows in all five panels; scrolling, wrapped descriptions, 7 widths, complete totals/counts, reimport, 5/4/3/0 items and print.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
