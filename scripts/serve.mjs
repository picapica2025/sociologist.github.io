import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { publicFiles } from './public-files.mjs';

const root = new URL(process.argv.includes('--dist') ? '../dist/' : '../', import.meta.url);
const mime = { html: 'text/html; charset=utf-8', txt: 'text/plain; charset=utf-8', xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png' };
const port = Number(process.env.PORT || 4173);

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!publicFiles.includes(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(new URL(file, root));
    response.writeHead(200, {
      'Content-Type': mime[file.split('.').pop()] || 'text/plain',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
});
