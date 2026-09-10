/**
 * Tiny static file server for local development.
 *
 *   node tools/serve.mjs [--port 8137] [--root .]
 *
 * The single-file build in `dist/` works without a server; this is only needed
 * when working on the modular sources in `src/`.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function parseArgs(argv) {
  const args = { port: 8137, root: ROOT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') args.port = Number(argv[++i]);
    else if (argv[i] === '--root') args.root = path.resolve(argv[++i]);
  }
  return args;
}

export function createServer(root = ROOT) {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let filePath = path.join(root, decodeURIComponent(url.pathname));
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
        return;
      }
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(String(error));
    }
  });
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const { port, root } = parseArgs(process.argv.slice(2));
  const server = createServer(root);
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`linkage designer: http://127.0.0.1:${port}/index.html\n`);
    process.stdout.write(`serving ${root}\n`);
  });
}
