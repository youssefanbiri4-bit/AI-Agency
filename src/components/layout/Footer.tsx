import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';

interface FooterProps {
  hide?: boolean;
}

export function Footer({ hide }: FooterProps) {
  if (hide) return null;

  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-divider bg-surface/40 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <BrandMark href="/" size="sm" className="mb-4" />
            <p className="text-sm leading-6 text-foreground-muted">
              AI agency operations platform.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/tasks"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Tasks
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/create-task"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Create Task
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dashboard/agents"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Agents
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/settings"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/reports"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Reports
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-foreground-muted hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-divider pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-foreground-muted">
              &copy; {currentYear} AgentFlow AI. All rights reserved.
            </p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="https://x.com/agentflowai" target="_blank" rel="noopener noreferrer" className="text-sm text-foreground-muted/70 hover:text-primary transition-colors">
                Twitter
              </a>
              <a href="https://linkedin.com/company/agentflowai" target="_blank" rel="noopener noreferrer" className="text-sm text-foreground-muted/70 hover:text-primary transition-colors">
                LinkedIn
              </a>
              <a href="https://github.com/agentflowai" target="_blank" rel="noopener noreferrer" className="text-sm text-foreground-muted/70 hover:text-primary transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
