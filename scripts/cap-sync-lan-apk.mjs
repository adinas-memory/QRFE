import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const backupPath = 'capacitor.config.prod.backup.ts';
const prodPath = 'capacitor.config.ts';
const lanApkPath = 'capacitor.config.lan-apk.ts';

if (!existsSync(lanApkPath)) {
  console.error('Missing capacitor.config.lan-apk.ts');
  process.exit(1);
}

if (!existsSync(backupPath)) {
  copyFileSync(prodPath, backupPath);
}

copyFileSync(lanApkPath, prodPath);

try {
  execSync('npx cap sync android', { stdio: 'inherit' });
} finally {
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, prodPath);
  }
}
