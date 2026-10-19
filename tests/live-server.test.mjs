import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startLiveServer } from '../scripts/live-server.mjs';

test('live reload serves only web assets and notifies the phone after rebuilding saved files', { timeout: 10000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'pocket-live-'));
  let live;
  const controller = new AbortController();
  t.after(async () => { controller.abort(); if (live) await live.close(); await rm(root, { recursive: true, force: true }); });
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'styles.css'), 'body{color:red}');
  await writeFile(join(root, 'dist/index.html'), '<html><body>Pocket</body></html>');
  live = await startLiveServer({ root, port: 0, build: async () => {
    await writeFile(join(root, 'dist/styles.css'), await readFile(join(root, 'styles.css')));
  } });
  const url = `http://127.0.0.1:${live.port}`;
  const page = await fetch(url);
  assert.match(await page.text(), /EventSource/);
  assert.doesNotMatch(await readFile(join(root, 'dist/index.html'), 'utf8'), /EventSource/);
  assert.equal((await fetch(`${url}/package.json`)).status, 404);
  const stream = await fetch(`${url}/__pocket_events`, { signal: controller.signal });
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /data: 0/);
  const refreshed = reader.read();
  await writeFile(join(root, 'styles.css'), 'body{color:blue}');
  assert.match(new TextDecoder().decode((await refreshed).value), /data: 1/);
  const css = await fetch(`${url}/styles.css`);
  assert.equal(await css.text(), 'body{color:blue}');
});
