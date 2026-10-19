import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const tools = join(root, '.tools');
const windows = process.platform === 'win32';
const candidates = [
  process.env.JAVA_HOME,
  ...(existsSync(tools) ? readdirSync(tools).filter(name => name.startsWith('jdk-')).map(name => join(tools, name)) : []),
  windows ? join(process.env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr') : null,
].filter(Boolean);
const javaHome = candidates.find(candidate => {
  const java = join(candidate, 'bin', windows ? 'java.exe' : 'java');
  if (!existsSync(java)) return false;
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const version = Number((result.stderr + result.stdout).match(/version "(\d+)/)?.[1]);
  return result.status === 0 && version >= 21 && version <= 24;
});
if (!javaHome) {
  console.error('Set JAVA_HOME to a JDK 21 installation. This Gradle wrapper supports Java 21–24.');
  process.exit(1);
}
const env = { ...process.env, JAVA_HOME: javaHome };
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && windows && env.LOCALAPPDATA) {
  env.ANDROID_HOME = join(env.LOCALAPPDATA, 'Android', 'Sdk');
}
console.log(`Building APK with Java from ${javaHome}`);
const result = spawnSync(windows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug', {
  cwd: join(root, 'android'), env, stdio: 'inherit', shell: true,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
