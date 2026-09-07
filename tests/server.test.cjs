'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { createServer, HOST } = require('../server.js');

let server, port;
test.before(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, resolve);
  });
  port = server.address().port;
});
test.after(() => new Promise(resolve => server.close(resolve)));
function request(requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port, path: requestPath, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('listens only on loopback and serves the application page', async () => {
  assert.equal(server.address().address, '127.0.0.1');
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.match(response.body.toString(), /<html lang="pt-BR">/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});
test('serves JavaScript, CSS, manifest and nested PNG with correct MIME types', async () => {
  for (const [file, type] of [
    ['/script.js', 'application/javascript'], ['/style.css', 'text/css'],
    ['/manifest.webmanifest', 'application/manifest+json'],
    ['/sw.js', 'application/javascript'], ['/pwa.js', 'application/javascript'],
    ['/src/icons/icon-192.png', 'image/png'], ['/vendor/jspdf.umd.min.js', 'application/javascript']
  ]) {
    const response = await request(file);
    assert.equal(response.status, 200, file);
    assert.ok(response.headers['content-type'].startsWith(type), file);
    assert.ok(response.body.length > 0, file);
  }
  assert.equal((await request('/sw.js')).headers['cache-control'], 'no-cache');
});
test('HEAD returns metadata without a body, and query strings work', async () => {
  const get = await request('/index.html?v=1');
  const head = await request('/index.html', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(Number(head.headers['content-length']), get.body.length);
});
test('rejects uploads and other write methods', async () => {
  const response = await request('/', 'POST');
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
});
test('does not expose source utilities, docs, fixtures, hidden files or directories', async () => {
  for (const file of ['/server.js','/preload.js','/INSTALACAO.md','/Iniciar-Producao.cmd','/tests/fixtures/producao-sintetica.txt','/tests/server.test.cjs','/.vscode/settings.json','/src/Thumbs.db','/src/','/vendor/']) {
    assert.equal((await request(file)).status, 404, file);
  }
});
test('rejects traversal, encoded traversal, Windows separators and malformed escapes', async () => {
  for (const file of ['/../script.js','/%2e%2e/script.js','/src/../../script.js','/src/%2e%2e/script.js','/src%5c..%5cscript.js','/script.js%00']) {
    assert.equal((await request(file)).status, 403, file);
  }
  assert.equal((await request('/%ZZ')).status, 400);
});
