import { execSync } from 'node:child_process';

execSync('npx cap sync android', {
  stdio: 'inherit',
  env: {
    ...process.env,
    CAPACITOR_LAN_APK: '1',
  },
});
