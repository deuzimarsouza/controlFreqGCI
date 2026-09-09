// Browser regression check: NODE_PATH must expose Playwright; requires Edge.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const project = process.env.GCI_PROJECT_DIR || path.resolve(__dirname, '..');
const tableIds = ['generalTable', 'mizunoTable', 'underArmourTable', 'specialTable', 'chuteiraTable'];
const prefixes = ['CABEDAL INTUIT', 'CABEDAL MZ WAVE TESTE', 'CAB. CH. CAMPO TESTE', 'CABEDAL UA CHARGED TESTE'];
const widths = [1920, 1440, 1024, 768, 640, 390, 320];

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

function uniformFixture(count) {
  return { text: report(count), counts: tableIds.map(() => count), totals: tableIds.map(() => count * (count + 1) * 5) };
}

function mixedFixture() {
  const rows = ['RELATORIO SINTETICO — CATEGORIAS COM ALTURAS DIFERENTES'];
  const longDescription = ' ACABAMENTO EM TECIDO RESPIRAVEL COM COSTURAS REFORCADAS E DETALHES VERDES PARA CONFERENCIA INTEGRAL';
  for (let index = 0; index < 10; index += 1) {
    const model = index < 4 ? 'CORRE TESTE' : 'INTUIT';
    const details = index < 4 ? longDescription.repeat(index % 2 + 1) : ' AZUL';
    rows.push(`MT CAB0${String(index + 1).padStart(2, '0')} CABEDAL ${model} MODELO ${index + 1}${details} ${(10 - index) * 10}`);
  }
  for (let index = 0; index < 2; index += 1) {
    rows.push(`MT CAB1${index + 1} CABEDAL MZ WAVE TESTE MODELO ${index + 1}${index === 0 ? longDescription : ' AZUL'} ${(2 - index) * 10}`);
  }
  for (let index = 0; index < 8; index += 1) {
    rows.push(`MT CAB2${index + 1} CAB. CH. CAMPO TESTE MODELO ${index + 1} AZUL ${(8 - index) * 10}`);
  }
  rows.push('TOTAL : 940');
  return { text: rows.join('\n'), counts: [10, 2, 0, 6, 8], totals: [550, 30, 0, 210, 360] };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function importReport(page, fixture, label) {
  await page.locator('#fileInput').setInputFiles({
    name: `rolagem-${label}.txt`, mimeType: 'text/plain', buffer: Buffer.from(fixture.text)
  });
  await page.waitForFunction(expected =>
    document.querySelector('#fileInput').value === ''
    && document.querySelectorAll('#generalTable tr:not(:has(.empty))').length === expected, fixture.counts[0]);
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
    const wrapStyle = getComputedStyle(wrap);
    const scrollbar = getComputedStyle(wrap, '::-webkit-scrollbar');
    return {
      id: wrap.querySelector('tbody').id,
      count: rows.filter(row => !row.querySelector('.empty')).length,
      total: panel.querySelector('.item-total strong').textContent,
      scrollTop: wrap.scrollTop, scrollHeight: wrap.scrollHeight, clientHeight: wrap.clientHeight,
      panelHeight: panelBounds.height, panelMinHeight: getComputedStyle(panel).minHeight,
      panelInnerBottom: panelBounds.bottom - parseFloat(getComputedStyle(panel).borderBottomWidth),
      wrapTop: bounds.top + wrap.clientTop, wrapBottom: bounds.top + wrap.clientTop + wrap.clientHeight,
      headerBottom: head.bottom, overflow: wrapStyle.overflowY,
      scrollbarHidden: wrapStyle.scrollbarWidth === 'none' || scrollbar.display === 'none' || scrollbar.width === '0px',
      summaryFits: summary.left >= panelBounds.left && summary.right <= panelBounds.right && summary.bottom <= bounds.top + 1,
      rows: rows.map(row => { const rect = row.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; }),
      descriptions, empty: Boolean(wrap.querySelector('.empty')),
      quantities: rows.filter(row => !row.querySelector('.empty')).map(row => ({
        text: row.cells[2].textContent, clipped: row.cells[2].scrollWidth > row.cells[2].clientWidth + 1
      }))
    };
  }));
}

function verifyCounts(metrics, fixture) {
  assert.deepEqual(metrics.map(panel => panel.id), tableIds);
  for (const [index, panel] of metrics.entries()) {
    const count = fixture.counts[index];
    assert.equal(panel.count, count, `${panel.id}: all item rows retained`);
    assert.equal(panel.total, String(fixture.totals[index]), `${panel.id}: full quantity total`);
    assert.equal(panel.rows.length, count || 1, `${panel.id}: all rows retained`);
    assert.equal(panel.summaryFits, true, `${panel.id}: total fits outside scroller`);
    assert.equal(panel.quantities.reduce((sum, cell) => sum + Number(cell.text), 0), fixture.totals[index], `${panel.id}: every quantity retained`);
    for (const cell of panel.quantities) assert.equal(cell.clipped, false, `${panel.id}: quantity not clipped horizontally`);
  }
}

function verifyEqualHeight(metrics, label) {
  const heights = metrics.map(panel => panel.panelHeight);
  assert.ok(Math.max(...heights) - Math.min(...heights) <= 1.1, `${label}: all five outer panels have equal height (${heights.join(', ')})`);
  for (const panel of metrics) {
    assert.ok(panel.wrapBottom <= panel.panelInnerBottom + 1.1, `${label}/${panel.id}: viewport fits inside card`);
  }
}

function verifyFirstFour(metrics, label) {
  for (const panel of metrics) {
    const hint = `${label}/${panel.id}`;
    assert.equal(panel.scrollTop, 0, `${hint}: starts at first row`);
    assert.ok(panel.rows[0].top >= panel.headerBottom - 1, `${hint}: first row below header`);
    if (panel.count > 4) {
      assert.ok(panel.rows[3].bottom <= panel.wrapBottom + 1.1, `${hint}: fourth row fully visible`);
      assert.ok(panel.rows[4].top >= panel.wrapBottom - 1.1, `${hint}: fifth row below viewport`);
      assert.ok(Math.abs(panel.rows[3].bottom - panel.wrapBottom) <= 1.1, `${hint}: viewport ends at fourth row`);
      assert.ok(panel.scrollHeight > panel.clientHeight, `${hint}: remaining rows scroll`);
    } else {
      assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${hint}: all available rows fully visible`);
      assert.ok(panel.scrollHeight <= panel.clientHeight + 1, `${hint}: no unnecessary vertical scroll`);
    }
    assert.match(panel.overflow, /^(auto|scroll)$/, `${hint}: scrolling enabled`);
    assert.equal(panel.scrollbarHidden, true, `${hint}: scrollbar remains hidden`);
    for (const cell of panel.descriptions) {
      assert.notEqual(cell.whiteSpace, 'nowrap', `${hint}: wrapping preserved`);
      assert.equal(cell.clipped, false, `${hint}: description not clipped horizontally`);
    }
  }
}

async function verifyScrolling(page, fixture) {
  await page.locator('.table-wrap').evaluateAll(wraps => wraps.forEach(wrap => { wrap.scrollTop = wrap.scrollHeight; }));
  await settle(page);
  const metrics = await measure(page);
  verifyCounts(metrics, fixture);
  verifyEqualHeight(metrics, 'after scrolling');
  for (const panel of metrics) {
    if (panel.count > 4) assert.ok(panel.scrollTop > 0, `${panel.id}: scrolled`);
    assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${panel.id}: last row reachable`);
    assert.ok(panel.rows.at(-1).top >= panel.headerBottom - 1.1, `${panel.id}: last row visible below sticky header`);
  }
}

async function verifyPrint(page, fixture) {
  await page.emulateMedia({ media: 'print' });
  await settle(page);
  const metrics = await measure(page);
  verifyCounts(metrics, fixture);
  for (const panel of metrics) {
    assert.equal(panel.overflow, 'visible', `${panel.id}: print exposes all rows`);
    assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${panel.id}: print includes last row`);
    assert.ok(panel.wrapBottom <= panel.panelInnerBottom + 1.1, `${panel.id}: print card expands to all content`);
    assert.ok(panel.panelMinHeight === 'auto' || parseFloat(panel.panelMinHeight) <= 1, `${panel.id}: print removes screen minimum height`);
  }
  assert.ok((await page.pdf({ format: 'A4', printBackground: true })).length > 1000, 'print generates a PDF');
  await page.emulateMedia({ media: 'screen' });
  await settle(page);
  verifyFirstFour(await measure(page), 'after print');
  verifyEqualHeight(await measure(page), 'after print');
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
    verifyCounts(await measure(page), uniformFixture(0));
    verifyEqualHeight(await measure(page), 'initial empty state');
    assert.equal(await page.locator('.production-grid .empty').count(), 5);

    const many = uniformFixture(8);
    await importReport(page, many, 'muitos');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await settle(page);
      const metrics = await measure(page);
      verifyCounts(metrics, many);
      verifyFirstFour(metrics, `${width}px`);
      verifyEqualHeight(metrics, `${width}px`);
      for (const panel of metrics) assert.ok(panel.descriptions.some(cell => cell.height > cell.lineHeight * 3), `${width}px/${panel.id}: long description wraps across lines`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `page width ${width}`);
    }

    await verifyScrolling(page, many);
    await importReport(page, many, 'reimportado');
    verifyFirstFour(await measure(page), 'reimport');
    verifyEqualHeight(await measure(page), 'reimport');
    await verifyPrint(page, many);

    const mixed = mixedFixture();
    await importReport(page, mixed, 'quantidades-e-descricoes-diferentes');
    const mixedHeights = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await settle(page);
      const metrics = await measure(page);
      verifyCounts(metrics, mixed);
      verifyFirstFour(metrics, `mixed/${width}px`);
      verifyEqualHeight(metrics, `mixed/${width}px`);
      mixedHeights.push(metrics[0].panelHeight);
      assert.ok(Math.max(...metrics.map(panel => panel.clientHeight)) - Math.min(...metrics.map(panel => panel.clientHeight)) > 1, `${width}px: fixture exercises different viewport heights`);
      assert.ok(metrics[2].panelInnerBottom - metrics[2].wrapBottom > 20, `${width}px: empty category reserves blank card space`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `mixed page width ${width}`);
    }
    assert.ok(new Set(mixedHeights).size > 1, 'shared panel height adapts to wrapped content at different widths');
    await verifyScrolling(page, mixed);
    await importReport(page, mixed, 'misto-reimportado');
    verifyFirstFour(await measure(page), 'mixed reimport');
    verifyEqualHeight(await measure(page), 'mixed reimport');
    await verifyPrint(page, mixed);

    await importReport(page, uniformFixture(5), 'limite-com-rolagem');
    verifyCounts(await measure(page), uniformFixture(5));
    verifyFirstFour(await measure(page), 'five items');
    verifyEqualHeight(await measure(page), 'five items');

    for (const count of [4, 3, 0]) {
      await importReport(page, uniformFixture(count), `${count}-itens`);
      const metrics = await measure(page);
      verifyCounts(metrics, uniformFixture(count));
      verifyEqualHeight(metrics, `${count} items`);
      verifyFirstFour(metrics, `${count} items`);
      for (const panel of metrics) {
        assert.equal(panel.scrollTop, 0, `${panel.id}/${count}: scroll reset`);
        assert.ok(panel.scrollHeight <= panel.clientHeight + 1, `${panel.id}/${count}: no unnecessary vertical scroll`);
        assert.ok(panel.rows.at(-1).bottom <= panel.wrapBottom + 1.1, `${panel.id}/${count}: all content visible`);
        assert.equal(panel.empty, count === 0, `${panel.id}/${count}: empty-state handling`);
      }
    }
    await importReport(page, mixed, 'misto-depois-de-vazio');
    verifyCounts(await measure(page), mixed);
    verifyFirstFour(await measure(page), 'mixed after empty');
    verifyEqualHeight(await measure(page), 'mixed after empty');
    assert.deepEqual(pageErrors, [], 'no JavaScript errors');
    console.log('PASS: equal outer heights across all five panels; four fully visible rows, hidden scrollbars, complete scrolling/totals/quantities, wrapped descriptions, 7 widths, mixed 10/2/0/6/8 counts, empty/reimport, 5/4/3/0 items, and unconstrained print.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
