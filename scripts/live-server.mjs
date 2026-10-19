import http from 'node:http';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']],
  ['/native.js', ['native.js', 'text/javascript']], ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);
const client = `<script>(()=>{let version;const events=new EventSource('/__pocket_events');events.onmessage=e=>{if(version!==undefined&&version!==e.data)location.reload();version=e.data;};})();</script>`;

export async function startLiveServer({ root, build, port = 3001 }) {
  await build();
  let revision = 0, timer, rebuilding = false, pending = false, closed = false;
  const clients = new Set();
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/__pocket_events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      clients.add(res);
      res.write(`data: ${revision}\n\n`);
      req.on('close', () => clients.delete(res));
      return;
    }
    const file = files.get(path);
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    try {
      let data = await readFile(join(root, 'dist', file[0]));
      if (file[0] === 'index.html') data = data.toString().replace('</body>', `${client}</body>`);
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(data);
    } catch { res.writeHead(500); res.end('Build output unavailable'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  async function rebuild() {
    pending = true;
    if (rebuilding || closed) return;
    rebuilding = true;
    try {
      while (pending && !closed) {
        pending = false;
        try {
          await build();
          revision++;
          for (const res of clients) res.write(`data: ${revision}\n\n`);
          console.log('Saved changes: refreshing Pocket.');
        } catch (error) { console.error('Build failed; fix the file and save again.', error.message); }
      }
    } finally { rebuilding = false; }
  }
  const watched = new Set(['index.html', 'styles.css', 'app.js', 'native.js', 'purchase-storage.mjs', 'favicon.svg']);
  const watcher = watch(root, (_event, filename) => {
    if (!watched.has(String(filename))) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  });
  const heartbeat = setInterval(() => { for (const res of clients) res.write(': keepalive\n\n'); }, 15000);
  return {
    port: server.address().port,
    async close() {
      closed = true;
      clearTimeout(timer); clearInterval(heartbeat); watcher.close();
      for (const res of clients) res.end();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
