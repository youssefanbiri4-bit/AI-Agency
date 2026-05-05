'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();

  if (pathname?.startsWith('/dashboard')) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-black/8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <BrandMark href="/" size="sm" className="mb-4" />
            <p className="text-sm leading-6 text-black/58">
              Professional AI agent management platform.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-black mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/tasks"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Tasks
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/create-task"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Create Task
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-black mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dashboard/agents"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Agents
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/settings"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Integration Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/reports"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Reports
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-black mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-black/58 hover:text-[#8B3CDE] transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-black/8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-black/58">
              © {currentYear} AgentFlow AI. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <span className="text-sm text-black/46">
                Twitter
              </span>
              <span className="text-sm text-black/46">
                LinkedIn
              </span>
              <span className="text-sm text-black/46">
                GitHub
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
