'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getLanguageDir, resolveNestedKey, STORAGE_KEY, DEFAULT_LANGUAGE } from './index';
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

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en' || stored === 'fr' || stored === 'es') {
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
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = language;
    document.documentElement.dir = getLanguageDir(language);
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
  }, []);

  const currentTranslations = useMemo(() => {
    return translations[language] ?? (translations[DEFAULT_LANGUAGE] || en);
  }, [language, translations]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const resolved = resolveNestedKey(currentTranslations as Translations, key);
      if (resolved) return resolved;
      const enResolved = resolveNestedKey(en as Translations, key);
      if (enResolved) return enResolved;
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
