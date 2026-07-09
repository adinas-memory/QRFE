import { execSync } from 'node:child_process';

const lanIp = process.env['CAPACITOR_LAN_IP'] ?? '192.168.43.142';

execSync('node scripts/patch-android-lan-ip.mjs', {
  stdio: 'inherit',
  env: { ...process.env, CAPACITOR_LAN_IP: lanIp },
});

execSync('npx cap sync android', {
  stdio: 'inherit',
  env: {
    ...process.env,
    CAPACITOR_LAN_LIVE: '1',
    CAPACITOR_LAN_IP: lanIp,
  },
});
