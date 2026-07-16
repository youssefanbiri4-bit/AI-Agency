import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
import { RouteAwareFooter } from '@/components/layout/RouteAwareFooter';
import { ToastProvider } from '@/components/ui/toast';
import { LanguageProvider, type Translations } from '@/i18n/context';
import type { LanguageCode } from '@/i18n/index';
import en from '@/i18n/locales/en.json';
import ar from '@/i18n/locales/ar.json';
import { SentrySetup, SentryErrorBoundary } from '@/lib/sentry-client';
import { ThemeProvider } from '@/lib/theme-context';
import { ThemeScript } from '@/components/ThemeScript';
import { WebVitalsReporter } from '@/lib/monitoring/web-vitals';
import { PWAProvider } from '@/components/pwa/PWAProvider';
import { AnnouncementProvider } from '@/components/customer-success/AnnouncementProvider';
import { generateBaseStructuredData, serializeStructuredData } from '@/lib/seo/structured-data';

const iconVersion = 'agentflow-ai-v3';

const allTranslations: Partial<Record<LanguageCode, Translations>> = {
  en: en as Translations,
  ar: ar as Translations,
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: 'AgentFlow AI — AI Agency Operations Platform',
    template: '%s | AgentFlow AI',
  },
  description: 'A professional AI agency dashboard for managing autonomous agents, tasks, reviews, and workflows. Run AI agency work from one disciplined workspace.',
  applicationName: 'AgentFlow AI',
  manifest: `/manifest.json?v=${iconVersion}`,
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'AgentFlow AI — AI Agency Operations Platform',
    description: 'A professional AI agency dashboard for managing autonomous agents, tasks, reviews, and workflows.',
    url: BASE_URL,
    siteName: 'AgentFlow AI',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'AgentFlow AI — AI Agency Operations Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentFlow AI — AI Agency Operations Platform',
    description: 'A professional AI agency dashboard for managing autonomous agents, tasks, reviews, and workflows.',
    images: [`${BASE_URL}/og-image.jpg`],
  },
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
    capable: true,
    title: 'AgentFlow AI',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="ar" dir="rtl" className="h-full scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <Script src="/agentflow-language-init.js" strategy="beforeInteractive" nonce={nonce} />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(generateBaseStructuredData()),
          }}
          nonce={nonce}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} h-full flex flex-col bg-transparent text-foreground`}>
        <SentrySetup />
        <WebVitalsReporter />
        <ThemeProvider>
          <LanguageProvider translations={allTranslations}>
            <ToastProvider>
              <PWAProvider>
                <AnnouncementProvider>
                  <main className="flex-1">
                    <SentryErrorBoundary>{children}</SentryErrorBoundary>
                  </main>
                  <RouteAwareFooter />
                </AnnouncementProvider>
              </PWAProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
