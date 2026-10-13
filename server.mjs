import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.PORT || 3000);
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
http.createServer(async (req, res) => {
  const item = files[new URL(req.url, 'http://localhost').pathname];
  if (!item) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = await readFile(fileURLToPath(new URL(item[0], import.meta.url)));
    res.writeHead(200, { 'Content-Type': `${item[1]}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
  } catch { res.writeHead(500); res.end('Unable to load the app'); }
}).listen(port, '0.0.0.0', () => console.log(`Pocket is running at http://localhost:${port}\nOn your phone, open http://<this-computer-LAN-IP>:${port} on the same Wi-Fi.`));
