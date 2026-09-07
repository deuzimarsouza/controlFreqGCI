'use strict';

// Local-only static server. No dependencies or system configuration required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 4173;
const ROOT = fs.realpathSync(__dirname);
const APP_URL = `http://${HOST}:${PORT}/`;
const PUBLIC_FILES = new Set([
  'index.html', 'style.css', 'script.js', 'pdf-export.js', 'pwa.js',
  'manifest.webmanifest', 'sw.js', 'vendor/jspdf.umd.min.js',
  'src/app-icon-512.png', 'src/logo-instituicao.png', 'src/book-alt.png',
  'src/document.png', 'src/file-excel.png', 'src/upload.png', 'src/magic-wand.png',
  'src/icons/icon-192.png', 'src/icons/icon-512.png',
  'src/icons/icon-maskable-512.png', 'src/icons/icon.svg'
]);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function respondText(req, res, status, message, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(req.method === 'HEAD' ? undefined : message);
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      respondText(req, res, 405, 'Método não permitido.', { Allow: 'GET, HEAD' });
      return;
    }

    let requestedPath;
    try {
      // Validate the original path before URL normalization can hide '..'.
      requestedPath = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      respondText(req, res, 400, 'Endereço inválido.');
      return;
    }

    if (!requestedPath.startsWith('/') || /[\\\u0000-\u001f]/.test(requestedPath)
        || requestedPath.split('/').some(segment => segment === '..' || segment === '.')) {
      respondText(req, res, 403, 'Acesso não permitido.');
      return;
    }
    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.slice(1);
    if (!PUBLIC_FILES.has(relativePath)) {
      respondText(req, res, 404, 'Arquivo não encontrado.');
      return;
    }

    try {
      const filePath = await fs.promises.realpath(path.join(ROOT, relativePath));
      const relativeRealPath = path.relative(ROOT, filePath);
      if (relativeRealPath.startsWith('..') || path.isAbsolute(relativeRealPath)
          || !PUBLIC_FILES.has(relativeRealPath.split(path.sep).join('/'))) {
        respondText(req, res, 403, 'Acesso não permitido.');
        return;
      }
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        respondText(req, res, 404, 'Arquivo não encontrado.');
        return;
      }
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) respondText(req, res, 404, 'Arquivo não encontrado.');
      else res.destroy();
    }
  });
}

function openBrowser() {
  if (process.platform !== 'win32') {
    console.log(`Abra o navegador neste endereço: ${APP_URL}`);
    return;
  }
  // Hide only the helper console. The browser is opened by the user launcher.
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
    `Start-Process -FilePath '${APP_URL}'`
  ], { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log(`Abra o navegador neste endereço: ${APP_URL}`));
  child.on('exit', code => {
    if (code) console.log(`Abra o navegador neste endereço: ${APP_URL}`);
  });
}

if (require.main === module) {
  const server = createServer();
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`A porta ${PORT} já está em uso. Se a Produção GCI já estiver aberta, acesse ${APP_URL}`);
    } else {
      console.error('Não foi possível iniciar a Produção GCI:', error.message);
    }
    process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => {
    console.log(`\nProdução GCI disponível em ${APP_URL}`);
    console.log('Mantenha esta janela aberta durante o uso. Pressione Ctrl+C para encerrar.\n');
    if (process.argv.includes('--open')) openBrowser();
  });
}

module.exports = { createServer, HOST, PORT };
