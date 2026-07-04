import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const backupPath = 'capacitor.config.prod.backup.ts';
const prodPath = 'capacitor.config.ts';
const lanPath = 'capacitor.config.lan.ts';

if (!existsSync(lanPath)) {
  console.error('Missing capacitor.config.lan.ts');
  process.exit(1);
}

if (!existsSync(backupPath)) {
  copyFileSync(prodPath, backupPath);
}

copyFileSync(lanPath, prodPath);

try {
  execSync('npx cap sync', { stdio: 'inherit' });
} finally {
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, prodPath);
  }
}
