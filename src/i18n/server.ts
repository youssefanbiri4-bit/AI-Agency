import en from './locales/en.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import { resolveNestedKey, type LanguageCode } from './index';
import type { Translations } from './context';

const dictionaries = {
  en: en as Translations,
  ar: ar as Translations,
  es: es as Translations,
  fr: fr as Translations,
} as const;

export type ServerTranslator = (key: string, fallback?: string) => string;

/**
 * Server-side translator for use inside Server Components (e.g. the dashboard
 * page). It mirrors the client `t` behaviour: resolve the requested locale,
 * then fall back to English, then to the provided fallback / key.
 *
 * The dashboard page is rendered in English by default to stay consistent with
 * the rest of the server-rendered dashboard copy. The client LanguageProvider
 * re-resolves strings after mount for the active locale.
 */
export function getServerTranslator(lang: LanguageCode = 'en'): ServerTranslator {
  const dict = dictionaries[lang] ?? dictionaries.en;

  return (key: string, fallback?: string): string => {
    const resolved = resolveNestedKey(dict as Translations, key);
    if (resolved) return resolved;
    const enResolved = resolveNestedKey(dictionaries.en as Translations, key);
    if (enResolved) return enResolved;
    return fallback ?? key;
  };
}
