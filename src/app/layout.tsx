import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/toast';
import { LanguageProvider, type Translations } from '@/i18n/context';
import type { LanguageCode } from '@/i18n/index';
import en from '@/i18n/locales/en.json';
import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';
import es from '@/i18n/locales/es.json';

const iconVersion = 'agentflow-ai-v3';

const allTranslations: Partial<Record<LanguageCode, Translations>> = {
  en: en as Translations,
  ar: ar as Translations,
  fr: fr as Translations,
  es: es as Translations,
};

export const metadata: Metadata = {
  title: 'AgentFlow AI',
  description: 'A professional AI agency dashboard for managing autonomous agents, tasks, reviews, and workflows.',
  applicationName: 'AgentFlow AI',
  manifest: `/manifest.json?v=${iconVersion}`,
  icons: {
    icon: [
      { url: `/icon.svg?v=${iconVersion}`, type: 'image/svg+xml', sizes: 'any' },
      { url: `/favicon.svg?v=${iconVersion}`, type: 'image/svg+xml', sizes: 'any' },
      { url: `/favicon.ico?v=${iconVersion}`, sizes: 'any' },
    ],
    shortcut: `/favicon.ico?v=${iconVersion}`,
    apple: [
      { url: `/apple-icon.png?v=${iconVersion}`, sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    title: 'AgentFlow AI',
  },
};

const LANGUAGE_SCRIPT = `
(function(){try{var e=localStorage.getItem("agentflow-language");if(e==="ar"){document.documentElement.lang="ar";document.documentElement.dir="rtl"}else if(e==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr"}else if(e==="fr"){document.documentElement.lang="fr";document.documentElement.dir="ltr"}else if(e==="es"){document.documentElement.lang="es";document.documentElement.dir="ltr"}}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_SCRIPT }} />
      </head>
      <body className="h-full flex flex-col bg-transparent text-foreground">
        <LanguageProvider translations={allTranslations}>
          <ToastProvider>
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
