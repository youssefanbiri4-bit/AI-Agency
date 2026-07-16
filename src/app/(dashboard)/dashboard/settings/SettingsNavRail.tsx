'use client';

import { BarChart3, Building2, DatabaseBackup, Globe, Key, Palette, Puzzle, Settings2, ShieldCheck, SlidersHorizontal, Users, Wand2 } from 'lucide-react';
import { useLanguage } from '@/i18n/context';

const navItems = [
  { id: 'workspace', labelKey: 'page.settings.workspace', icon: Building2 },
  { id: 'usage-limits', labelKey: 'page.settings.usageLimits', icon: BarChart3 },
  { id: 'brand-kit', labelKey: 'page.settings.brandKit', icon: Palette },
  { id: 'white-label', labelKey: 'White Label', icon: Wand2 },
  { id: 'custom-domains', labelKey: 'Custom Domains', icon: Globe },
  { id: 'sso', labelKey: 'SSO', icon: Key },
  { id: 'providers', labelKey: 'page.settings.providers', icon: Puzzle },
  { id: 'publishing-scheduling', labelKey: 'page.settings.publishingScheduling', icon: Settings2 },
  { id: 'roles-permissions', labelKey: 'page.settings.rolesPermissions', icon: Users },
  { id: 'security', labelKey: 'page.settings.security', icon: ShieldCheck },
  { id: 'backups', labelKey: 'page.settings.backups', icon: DatabaseBackup },
  { id: 'advanced', labelKey: 'page.settings.advanced', icon: SlidersHorizontal },
] as const;

export function SettingsNavRail({
  activeSection,
  onSectionChange,
}: {
  activeSection: string;
  onSectionChange: (id: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="settings-nav-mobile" className="sr-only">
          Navigate to section
        </label>
        <select
          id="settings-nav-mobile"
          value={activeSection}
          onChange={(e) => onSectionChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-white p-3 text-sm font-bold text-black/66"
        >
          {navItems.map((item) => (
            <option key={item.id} value={item.id}>
              {t(item.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <nav
        aria-label="Settings sections"
        className="sticky top-28 hidden h-fit w-56 shrink-0 lg:block"
      >
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors hover:bg-black/5 aria-[current=true]:bg-black aria-[current=true]:text-white"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
