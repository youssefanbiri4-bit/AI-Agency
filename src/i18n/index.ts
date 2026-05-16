import type { Translations } from './context';

export type LanguageCode = 'ar' | 'en' | 'fr' | 'es';

export const LANGUAGES: { code: LanguageCode; label: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'ar' || value === 'en' || value === 'fr' || value === 'es';
}

export function getLanguageDir(code: LanguageCode): 'rtl' | 'ltr' {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang?.dir ?? 'ltr';
}

export function resolveNestedKey(obj: Translations, key: string): string {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    if (typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === 'string') return current;
  return '';
}

export const DEFAULT_LANGUAGE: LanguageCode = 'ar';
export const STORAGE_KEY = 'agentflow-language';
