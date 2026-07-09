import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const lanIp = process.env['CAPACITOR_LAN_IP'] ?? '192.168.43.142';
const configPath = join(
  process.cwd(),
  'android/app/src/main/res/xml/network_security_config.xml',
);

const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- LAN dev APK: cleartext HTTP to API host (patched by patch-android-lan-ip.mjs). -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">${lanIp}</domain>
    </domain-config>
</network-security-config>
`;

writeFileSync(configPath, xml, 'utf8');
console.log(`[QRFE] network_security_config.xml → cleartext allowed for ${lanIp}`);
