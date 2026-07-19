'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getLanguageDir, isLanguageCode, resolveNestedKey, STORAGE_KEY, DEFAULT_LANGUAGE } from './index';
import type { LanguageCode } from './index';
import en from './locales/en.json';

export type Translations = Record<string, unknown>;

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

async function loadLanguageTranslations(code: LanguageCode): Promise<Translations | null> {
  if (code === 'ar') return (await import('./locales/ar.json')).default as Translations;
  if (code === 'fr') return (await import('./locales/fr.json')).default as Translations;
  if (code === 'es') return (await import('./locales/es.json')).default as Translations;
  return en as Translations;
}

function readStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({
  children,
  translations,
}: {
  children: ReactNode;
  translations: Partial<Record<LanguageCode, Translations>>;
}) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [loadedTranslations, setLoadedTranslations] =
    useState<Partial<Record<LanguageCode, Translations>>>(translations);

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== language) {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = language;
    document.documentElement.dir = getLanguageDir(language);
  }, [language]);

  useEffect(() => {
    if (loadedTranslations[language]) return;

    let cancelled = false;

    loadLanguageTranslations(language)
      .then((nextTranslations) => {
        if (!cancelled && nextTranslations) {
          setLoadedTranslations((current) => ({
            ...current,
            [language]: nextTranslations,
          }));
        }
      })
      .catch(() => {
        /* Keep English fallback if a locale chunk cannot load. */
      });

    return () => {
      cancelled = true;
    };
  }, [language, loadedTranslations]);

  const setLanguage = useCallback((code: LanguageCode) => {
    if (!isLanguageCode(code)) return;
    setLanguageState(code);
  }, []);

  const currentTranslations = useMemo(() => {
    return loadedTranslations[language] ?? loadedTranslations.en ?? en;
  }, [language, loadedTranslations]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      try {
        const resolved = resolveNestedKey(currentTranslations as Translations, key);
        if (resolved) return resolved;
        const enResolved = resolveNestedKey(en as Translations, key);
        if (enResolved) return enResolved;
      } catch {
        const enResolved = resolveNestedKey(en as Translations, key);
        if (enResolved) return enResolved;
      }
      return fallback ?? key;
    },
    [currentTranslations]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      dir: getLanguageDir(language),
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}

export function useOptionalLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  const fallbackT = useCallback((key: string, fallback?: string) => {
    const enResolved = resolveNestedKey(en as Translations, key);
    if (enResolved) return enResolved;
    return fallback ?? key;
  }, []);

  return context ?? {
    language: DEFAULT_LANGUAGE,
    setLanguage: () => {},
    t: fallbackT,
    dir: getLanguageDir(DEFAULT_LANGUAGE),
  };
}
