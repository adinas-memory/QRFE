export interface FiscalErrorInfo {
  title: string;
  steps: string[];
}

const CATALOG: Record<string, FiscalErrorInfo> = {
  DATECS_33022: {
    title: 'Casa de marcat neconectată',
    steps: [
      'Verificați că echipamentul este în mod de vânzare și mod CONEXIUNE PC.',
      'Verificați cablul (USB/COM) și portul configurat în FiscalNet.',
    ],
  },
  DATECS_10500: {
    title: 'Setări regionale Windows incorecte',
    steps: [
      'Setați „." ca simbol zecimal și „," la grupare (Numbers și Currency).',
      'Reinstalați DUDE: ștergeți „Datecs Aplications" din Program Files, apoi Salvează și testează în FiscalNet.',
    ],
  },
  DATECS_10505: {
    title: 'Valoare incorectă pe bon (setări regionale / TVA)',
    steps: [
      'Setați „." ca simbol zecimal la Numbers și Currency.',
      'Reinstalați DUDE după modificarea setărilor regionale.',
      'Verificați indicii TVA: 1=21%, 2=11%, 5=0%.',
    ],
  },
  DATECS_111015: {
    title: 'Total bon diferă de suma produselor',
    steps: [
      'Folosiți 2 zecimale în aplicația de vânzare.',
      'Calculați plecând de la prețul cu TVA inclus.',
    ],
  },
  DATECS_111005: {
    title: 'Cotă TVA interzisă pe bon',
    steps: [
      'Anulați bonul blocat: Operațiuni bon → Anulare bon blocat.',
      'Verificați maparea cotelor TVA în setările restaurantului.',
    ],
  },
  DAISY_82: {
    title: 'Raport Z necesar (24h depășite)',
    steps: ['Efectuați raportul Z din FiscalNet sau de pe echipament.'],
  },
  DAISY_255: {
    title: 'Echipamentul nu este în mod PC',
    steps: [
      'Porniți casa și apăsați MODE până apare „PC".',
      'Apăsați 9999 sau 8888 + CLK; pe display trebuie să apară cablu USB.',
    ],
  },
  TREMOL_101: {
    title: 'Eroare conexiune ZfpLabServer (Tremol)',
    steps: [
      'Opriți FiscalNet și ZfpLabServer.',
      'Dezinstalați ZfpLabServer, ștergeți folderul din Program Files, reporniți FiscalNet.',
      'Rulați FiscalNet și ZFPLabServer.exe ca administrator.',
    ],
  },
  TREMOL_30: {
    title: 'Conexiune socket eșuată (Tremol)',
    steps: [
      'Verificați că ZfpLabServer rulează în C:\\FiscalNet\\Servers\\Tremol.',
      'Repetiți pașii de la TREMOL_101 dacă serverul nu răspunde.',
    ],
  },
  ORGTECH_xC3: {
    title: 'Mod imprimantă fiscală neactivat (Orgtech)',
    steps: [
      'Setați casa în Mod imprimantă: 3+TL, 5555+TL, 5+TL, +%+TL, +%+%+1+TL.',
      'Opriți și reporniți casa, apoi apăsați TL.',
    ],
  },
  'BONOK=0': {
    title: 'Bonul fiscal nu a putut fi emis',
    steps: ['Verificați jurnalul FiscalNet pentru codul exact al casei de marcat.'],
  },
  'BONOK=-1': {
    title: 'Driver FiscalNet indisponibil',
    steps: ['Verificați că FiscalNet rulează pe PC (de obicei 127.0.0.1:65400).'],
  },
  NOT_FISCALNET_API: {
    title: 'Pe portul 65400 rulează emulatorul ESC/POS, nu FiscalNet',
    steps: [
      'Emulatorul de bonuri nefiscale nu trebuie să asculte pe portul 65400.',
      'Păstrați ESC/POS pe port 9100; instalați driverul FiscalNet (sau stub-ul de test) pe 65400.',
      'În Configurator: imprimanta fiscală = FiscalNet, IP LAN al PC-ului, port 65400.',
    ],
  },
};

/** i18n-backed Epson / unknown codes (DATECS/FiscalNet stay in CATALOG as RO-specific). */
const I18N_ERROR_CODES = new Set(['FPMATE_UNREACHABLE']);

export type FiscalErrorTranslate = (key: string, params?: Record<string, unknown>) => string;

export function resolveFiscalErrorInfo(
  errorCode: string | null | undefined,
  t: FiscalErrorTranslate,
): FiscalErrorInfo {
  if (!errorCode?.trim()) {
    return {
      title: t('restaurantSettings.fiscalPrinter.errors.unknownGeneric.title'),
      steps: [t('restaurantSettings.fiscalPrinter.errors.unknownGeneric.step1')],
    };
  }

  const key = errorCode.trim();
  const fromCatalog = CATALOG[key];
  if (fromCatalog) {
    return fromCatalog;
  }

  if (I18N_ERROR_CODES.has(key)) {
    return {
      title: t(`restaurantSettings.fiscalPrinter.errors.${key}.title`),
      steps: [t(`restaurantSettings.fiscalPrinter.errors.${key}.step1`)],
    };
  }

  return {
    title: t('restaurantSettings.fiscalPrinter.errors.unknown.title', { code: key }),
    steps: [t('restaurantSettings.fiscalPrinter.errors.unknown.step1')],
  };
}
