import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.join(process.cwd(), 'src/i18n/locales');
const LOCALES = ['en', 'ar', 'fr'];

function readLocale(locale) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8'));
}

function flattenKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(child, nextPrefix);
  });
}

const dictionaries = Object.fromEntries(LOCALES.map((locale) => [locale, readLocale(locale)]));
const keySets = Object.fromEntries(
  Object.entries(dictionaries).map(([locale, dictionary]) => [locale, new Set(flattenKeys(dictionary))])
);
const allKeys = new Set(Object.values(keySets).flatMap((set) => [...set]));

let hasMissing = false;
for (const locale of LOCALES) {
  const missing = [...allKeys].filter((key) => !keySets[locale].has(key)).sort();
  if (missing.length > 0) {
    hasMissing = true;
    console.log(`\\n${locale}: missing ${missing.length} keys`);
    for (const key of missing) console.log(`  - ${key}`);
  }
}

if (hasMissing) {
  process.exitCode = 1;
} else {
  console.log(`Translation keys match for ${LOCALES.join(', ')}.`);
}
