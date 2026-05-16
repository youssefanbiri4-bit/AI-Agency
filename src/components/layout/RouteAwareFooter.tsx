'use client';

import { usePathname } from 'next/navigation';
import { Footer } from './Footer';

export function RouteAwareFooter() {
  const pathname = usePathname();

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return null;
  }

  return <Footer />;
}
