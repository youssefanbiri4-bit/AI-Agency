import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/layout/Footer';

const iconVersion = 'agentflow-ai-v3';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" data-scroll-behavior="smooth">
      <body className="h-full flex flex-col bg-white text-foreground">
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
