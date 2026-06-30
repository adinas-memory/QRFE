import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nJs = fs.readFileSync(
  path.join(process.env.USERPROFILE ?? '', 'Downloads', 'urs', 'urs', 'js', 'i18n.js'),
  'utf8'
);

const match = i18nJs.match(/var I18N = (\{[\s\S]*?\n  \});\s*\n\s*var STORE_KEY/);
if (!match) throw new Error('Could not parse I18N from i18n.js');
const I18N = Function(`"use strict"; return (${match[1]});`)();

function flatToNested(flat) {
  const out = { brand: 'U.R.S.', subscribe: '', perMonth: '' };
  for (const [key, value] of Object.entries(flat)) {
    if (key === 'meta.title') continue;
    if (key === 'price.permo') {
      out.perMonth = value;
      continue;
    }
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] ??= {};
      cur = cur[parts[i]];
    }
    cur[parts.at(-1)] = value;
  }
  return out;
}

const subscribeByLang = {
  en: 'Subscribe',
  it: 'Abbonati',
  fr: "S'abonner",
  es: 'Suscribirse',
  de: 'Abonnieren',
  sv: 'Prenumerera',
  ro: 'Abonează-te',
};

const i18nDir = path.join(__dirname, '..', 'src', 'assets', 'i18n');

for (const code of Object.keys(subscribeByLang)) {
  const dict = I18N[code];
  if (!dict) continue;
  const landing = flatToNested(dict);
  landing.subscribe = subscribeByLang[code];

  const file = path.join(i18nDir, `${code}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.landing = landing;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log(`Updated ${code}.json`);
}
