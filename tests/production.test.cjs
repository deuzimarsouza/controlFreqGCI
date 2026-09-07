/* Synthetic-only regression checks. Run from project root:
 * node --test <path-to-this-file>
 * Uses application source unchanged, a minimal DOM, and bundled jsPDF.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { TextDecoder, TextEncoder } = require('node:util');
const projectDir = process.env.GCI_PROJECT_DIR || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectDir, 'script.js'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'producao-sintetica.txt'), 'utf8');

function element(tagName = 'div') {
  const classes = new Set();
  return {
    tagName, children: [], dataset: {}, style: {}, attributes: {}, listeners: {},
    textContent: '', className: '', value: '', disabled: false,
    classList: {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
      contains: value => classes.has(value),
      toggle(value, force) { const on = force === undefined ? !classes.has(value) : force; if (on) classes.add(value); else classes.delete(value); return on; }
    },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    click() {}, remove() {}, focus() {}, cloneNode() { return element(tagName); }
  };
}
function loadApp() {
  const elements = new Map();
  const document = {
    body: element('body'), documentElement: element('html'),
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element,
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, dispatchEvent() {}
  };
  document.getElementById('emptyRowTemplate').content = element('fragment');
  const context = vm.createContext({
    document, console, TextDecoder, TextEncoder, Blob, URL,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(), navigator: {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    addEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addEventListener() {} })
  });
  context.window = context;
  vm.runInContext(source, context, { filename: 'script.js' });
  return { context, elements, importReport(text = fixture, officialOverride) {
    context.testReport = text;
    vm.runInContext(`todosItens = parseReport(testReport); totalOficialRelatorio = extractOfficialTotal(testReport); currentReportName = 'producao-sintetica.txt'; separateItems();`, context);
    if (officialOverride !== undefined) vm.runInContext(`totalOficialRelatorio = ${Number(officialOverride)}`, context);
    return context.buildProductionSummary();
  }};
}
const plain = value => JSON.parse(JSON.stringify(value));

test('imports CAB records, ignores totals/headers and reads thousands separators', () => {
  const app = loadApp(), summary = app.importReport();
  assert.equal(summary.lineCount, 8);
  assert.equal(summary.totalCalculated, 2100);
  assert.equal(summary.totalOfficial, 2100);
  assert.equal(app.context.extractOfficialTotal('TOTAL : 1\nTOTAL : 2.100\n'), 2100);
});
test('decodes UTF-8 and Windows-1252 reports', () => {
  const { context } = loadApp();
  assert.equal(context.decodeReport(new TextEncoder().encode('produção')), 'produção');
  assert.equal(context.decodeReport(Uint8Array.from([0x70,0x72,0x6f,0x64,0x75,0xe7,0xe3,0x6f])), 'produção');
});
test('preserves injected model boundaries, junior variants and INTUIT exception', () => {
  const { context } = loadApp();
  for (const [input, expected] of [
    ['CABEDAL SPACE 6 JUNIOR BRANCO','SPACE 6 JUNIOR'], ['CABEDAL JET 8 JUNIOR PRETO','JET 8 JUNIOR'],
    ['cabedál intuíT preto','INTUIT'], ['CABEDAL INTUIT 2 PRETO',''], ['CABEDAL INTUIT 20',''],
    ['CABEDAL ONLY 30',''], ['CABEDAL SPACE 60',''], ['CABEDAL /ONLY 3-PRETO','ONLY 3']
  ]) assert.equal(context.identifySpecialModel(input), expected, input);
});
test('keeps brands exclusive and injected classification parallel to brands', () => {
  const app = loadApp(), summary = app.importReport();
  assert.deepEqual(plain(summary.modelGroups.map(group => [group.id, group.total])), [
    ['OLYMPIKUS',1800], ['MIZUNO',150], ['CHUTEIRAS',80], ['UNDER_ARMOUR',70], ['INJETADOS',1650]
  ]);
  assert.equal(app.context.identifyBrandCategory('CABEDAL UA CABEDAL MZ CAB. CH. TESTE'), 'UNDER_ARMOUR');
  assert.equal(app.context.identifyBrandCategory('CABEDAL MZ CAB. CH. TESTE'), 'MIZUNO');
  assert.equal(summary.totalFrequency,450);
  assert.equal(summary.totalMizunoWithoutInjected,100);
  assert.equal(summary.totalOlympikusWithoutInjected,200);
});
test('uses official total as base and falls back to parsed rows when absent', () => {
  const app = loadApp(), mismatch = app.importReport(fixture,2200);
  assert.equal(mismatch.totalFrequency,550); assert.equal(mismatch.totalOlympikus,1900);
  assert.equal(mismatch.totalCalculated,2100);
  app.context.updateReportStatus('sintetico.txt');
  assert.match(app.elements.get('statusMessage').textContent,/Divergência/);
  const absent = app.importReport(fixture,0);
  assert.equal(absent.totalFrequency,450); assert.equal(absent.totalOlympikus,1800);
  app.context.updateReportStatus('sintetico.txt');
  assert.match(app.elements.get('statusMessage').textContent,/soma das linhas/);
});
test('warns on empty reports and errors on categories above official total', () => {
  const app = loadApp(); app.importReport('TOTAL : 2.100'); app.context.updateReportStatus('vazio.txt');
  assert.match(app.elements.get('statusMessage').textContent,/Nenhuma linha/);
  app.importReport(fixture,100); app.context.updateReportStatus('sintetico.txt');
  assert.equal(app.elements.get('statusMessage').className,'status error');
});
test('aggregates duplicate models across phases and sorts by descending quantity', () => {
  const app = loadApp(), olympikus = app.importReport().modelGroups[0];
  assert.equal(olympikus.models.length,3); assert.equal(olympikus.models[0].artigo,'CAB001');
  assert.deepEqual(plain(olympikus.models.map(model => model.quantidade)),[1300,300,200]);
});
test('renders consistent cards and safe text in three cells per item', () => {
  const app = loadApp(); app.importReport(); app.context.renderAll();
  for (const [id,value] of Object.entries({officialTotal:'2.100',totalFrequencia:'450',totalGeneral:'1.800',totalSpecial:'1.650',totalMizuno:'150',totalChuteiras:'80',totalUnderArmour:'70'})) assert.equal(app.elements.get(id).textContent,value,id);
  assert.equal(app.elements.get('generalTable').children.length,4);
  assert.equal(app.elements.get('generalTable').children[0].children.length,3);
  const table = element('tbody');
  app.context.renderTable(table,[{artigo:'CAB99',descricao:'<img src=x onerror=alert(1)>',quantidade:12}]);
  assert.equal(table.children[0].children[1].textContent,'<img src=x onerror=alert(1)>');
});
test('clearing a report clears totals and disables exports', () => {
  const app = loadApp(); app.importReport(); app.context.clearReport();
  assert.equal(app.context.buildProductionSummary().lineCount,0);
  assert.equal(app.elements.get('totalGeneral').textContent,'0');
  assert.equal(app.elements.get('btnExportExcel').disabled,true);
  assert.equal(app.elements.get('btnExportPdf').disabled,true);
});
test('rejects unsupported types and files above 15 MB before reading', () => {
  const app = loadApp(); app.context.readFile({name:'programa.exe',size:10});
  assert.match(app.elements.get('statusMessage').textContent,/Formato não suportado/);
  app.context.readFile({name:'grande.txt',size:15*1024*1024+1});
  assert.match(app.elements.get('statusMessage').textContent,/limite de 15 MB/);
});
test('exports seven sheets with numeric totals and escaped literal text', () => {
  const app = loadApp(), summary = app.importReport(), sheets = app.context.buildProductionWorkbookDashboard(summary);
  assert.deepEqual(plain(sheets.map(sheet => sheet.name)),['Resumo','Classificados','Olympikus','Mizuno','Chuteiras','Under Armour','Injetados']);
  const xml = app.context.buildXlsxWorksheet(sheets[0]);
  assert.match(xml,/<c r="A5"[^>]*><v>2100<\/v><\/c>/); assert.match(xml,/<c r="B5"[^>]*><v>450<\/v><\/c>/);
  const literal = app.context.buildXlsxCell('=SUM(A1)&<teste>',1,1);
  assert.match(literal,/t="inlineStr"/); assert.match(literal,/=SUM\(A1\)&amp;&lt;teste&gt;/); assert.doesNotMatch(literal,/<f>/);
  const bytes = Buffer.from(app.context.buildProductionXlsx(summary));
  assert.equal(bytes.readUInt32LE(0),0x04034b50);
  assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length-12),14);
  assert.equal(bytes.includes(Buffer.from('xl/worksheets/sheet7.xml')),true);
});
test('creates an actual PDF using bundled jsPDF and sanitizes output names', () => {
  const app = loadApp(), summary = app.importReport();
  app.context.jspdf = require(path.join(projectDir,'vendor','jspdf.umd.min.js'));
  vm.runInContext(fs.readFileSync(path.join(projectDir,'pdf-export.js'),'utf8'),app.context,{filename:'pdf-export.js'});
  const pdf = app.context.productionPdf.create(summary), bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-'); assert.equal(pdf.getNumberOfPages(),2); assert.ok(bytes.length>1000);
  assert.equal(app.context.productionPdf.defaultFileName('Produção setembro.txt'),'Resumo-Producao-Producao-setembro.pdf');
  assert.equal(app.context.defaultExcelFileName('Produção setembro.txt'),'Resumo-Producao-Producao-setembro.xlsx');
});
test('HTML contains application DOM IDs and a three-column empty state', () => {
  const html = fs.readFileSync(path.join(projectDir,'index.html'),'utf8');
  for (const match of source.matchAll(/document\.getElementById\("([^"]+)"\)/g)) assert.ok(html.includes(`id="${match[1]}"`),`Missing DOM ID: ${match[1]}`);
  assert.match(html,/<template id="emptyRowTemplate">[\s\S]*?colspan="3"[\s\S]*?<\/template>/);
});
