import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, '..', 'src', 'assets', 'i18n');

const updates = {
  en: {
    note: 'Set up in minutes · Cancel anytime',
    mobileD: 'Turn any phone or tablet into a POS. Take orders at the table and send them straight to the kitchen and bar.',
  },
  ro: {
    note: 'Configurare în câteva minute · Anulezi oricând',
    mobileD: 'Transformi orice telefon sau tabletă într-un POS. Preiei comenzi la masă și le trimiți direct la bucătărie și bar.',
  },
  it: {
    note: 'Configurazione in pochi minuti · Disdici quando vuoi',
    mobileD: 'Trasforma qualsiasi telefono o tablet in un POS. Prendi gli ordini al tavolo e inviali direttamente in cucina e bar.',
  },
  fr: {
    note: 'Installation en quelques minutes · Annulable à tout moment',
    mobileD: 'Transformez n\'importe quel téléphone ou tablette en caisse. Prenez les commandes à table et envoyez-les directement en cuisine et au bar.',
  },
  es: {
    note: 'Configuración en minutos · Cancela cuando quieras',
    mobileD: 'Convierte cualquier móvil o tablet en un TPV. Toma pedidos en la mesa y envíalos directo a cocina y barra.',
  },
  de: {
    note: 'In Minuten eingerichtet · Jederzeit kündbar',
    mobileD: 'Mach aus jedem Handy oder Tablet eine Kasse. Nimm Bestellungen am Tisch auf und schick sie direkt in die Küche und an die Bar.',
  },
  sv: {
    note: 'Igång på några minuter · Avsluta när du vill',
    mobileD: 'Gör vilken mobil eller surfplatta som helst till en kassa. Ta beställningar vid bordet och skicka dem direkt till köket och baren.',
  },
};

for (const [code, t] of Object.entries(updates)) {
  const file = path.join(i18nDir, `${code}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.landing.hero.note = t.note;
  json.landing.feat.mobile.d = t.mobileD;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log(`Updated ${code}.json`);
}
