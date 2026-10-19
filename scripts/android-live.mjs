import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { buildWeb } from './build.mjs';
import { startLiveServer } from './live-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
const adb = sdk ? join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb') : 'adb';
function run(command, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: capture ? 'pipe' : 'inherit' });
    let output = '', error = '';
    if (capture) { child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); }
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(output) : reject(new Error(`${command} failed. ${error}`)));
  });
}
let live;
try {
  if (sdk && !existsSync(adb)) throw new Error('Android platform-tools not found. Install them using Android Studio SDK Manager.');
  const devices = (await run(adb, ['devices'], true)).split(/\r?\n/).map(line => line.match(/^(\S+)\s+device$/)?.[1]).filter(id => id && !id.startsWith('emulator-'));
  const device = process.env.ANDROID_SERIAL || (devices.length === 1 ? devices[0] : null);
  if (!device) throw new Error('Connect and unlock your Pixel, enable USB debugging and accept its authorization prompt. For multiple phones, set ANDROID_SERIAL.');
  live = await startLiveServer({ root, build: buildWeb, port: 3001 });
  await run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
  const configPath = join(root, 'android/app/src/main/assets/capacitor.config.json');
  const original = await readFile(configPath, 'utf8');
  const config = JSON.parse(original);
  config.server = { ...config.server, url: 'http://localhost:3001', cleartext: true };
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2));
    await run(process.execPath, ['scripts/android-build.mjs']);
  } finally { await writeFile(configPath, original); }
  await run(adb, ['-s', device, 'reverse', 'tcp:3001', 'tcp:3001']);
  await run(adb, ['-s', device, 'install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk']);
  await run(adb, ['-s', device, 'shell', 'am', 'force-stop', 'com.pocket.financetracker']);
  await run(adb, ['-s', device, 'shell', 'am', 'start', '-W', '-n', 'com.pocket.financetracker/.MainActivity']);
  console.log('\nLive reload is ready. Keep the phone connected and this terminal open. Save web files to refresh.\nPress Ctrl+C to stop. For an offline APK, run npm run android:apk.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await live.close(); process.exit(0); });
} catch (error) {
  console.error(error.message);
  if (live) await live.close();
  process.exitCode = 1;
}
