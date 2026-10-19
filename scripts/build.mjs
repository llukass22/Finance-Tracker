import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
export async function buildWeb() {
await mkdir(output, { recursive: true });
for (const file of ['styles.css', 'app.js', 'favicon.svg']) {
  await copyFile(new URL(file, root), new URL(file, output));
}
const html = await readFile(new URL('index.html', root), 'utf8');
await writeFile(new URL('index.html', output), html.replace('<script src="app.js" defer>', '<script src="native.js" defer></script><script src="app.js" defer>'));
await build({
  entryPoints: [fileURLToPath(new URL('native.js', root))],
  outfile: fileURLToPath(new URL('native.js', output)),
  bundle: true,
  format: 'iife',
  target: 'es2020',
});
console.log('Built Pocket web assets in dist/');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildWeb();
}
