'use client';

import { useState, useCallback } from 'react';
import {
  Share2,
  X,
  Users,
  Globe,
  Mail,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ShareWidgetProps {
  url: string;
  title: string;
  text?: string;
  variant?: 'inline' | 'dropdown' | 'buttons';
  className?: string;
}

type Network = 'twitter' | 'linkedin' | 'facebook' | 'email' | 'copy';

const NETWORK_CONFIG: Record<Network, {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  color: string;
}> = {
  twitter: { icon: X, label: 'Twitter', color: '#1DA1F2' },
  linkedin: { icon: Users, label: 'LinkedIn', color: '#0A66C2' },
  facebook: { icon: Globe, label: 'Facebook', color: '#1877F2' },
  email: { icon: Mail, label: 'Email', color: '#6B7280' },
  copy: { icon: Copy, label: 'Copy Link', color: '#6B7280' },
};

function buildShareUrl(network: Network, url: string, title: string, text?: string): string {
  switch (network) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text ?? title)}&url=${encodeURIComponent(url)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text ?? ''} ${url}`)}`;
    case 'copy':
      return url;
    default:
      return url;
  }
}

export function ShareWidget({
  url,
  title,
  text,
  variant = 'inline',
  className,
}: ShareWidgetProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async (network: Network) => {
    if (network === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        window.open(url, '_blank');
      }
      return;
    }

    const shareUrl = buildShareUrl(network, url, title, text);
    window.open(shareUrl, '_blank', 'width=600,height=400');
  }, [url, title, text]);

  if (variant === 'buttons') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {(Object.keys(NETWORK_CONFIG) as Network[]).map((network) => {
          const config = NETWORK_CONFIG[network];
          const Icon = config.icon;
          const isCopied = network === 'copy' && copied;

          return (
            <Button
              key={network}
              variant="outline"
              size="sm"
              onClick={() => handleShare(network)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {isCopied ? 'Copied!' : config.label}
            </Button>
          );
        })}
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className={cn('relative group', className)}>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>

        <div className="invisible group-hover:visible absolute right-0 top-full mt-2 z-50 w-48 rounded-lg border border-border bg-surface-elevated shadow-lg">
          <div className="p-2">
            {(Object.keys(NETWORK_CONFIG) as Network[]).map((network) => {
              const config = NETWORK_CONFIG[network];
              const Icon = config.icon;
              const isCopied = network === 'copy' && copied;

              return (
                <button
                  key={network}
                  type="button"
                  onClick={() => handleShare(network)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface"
                >
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                  {isCopied ? 'Copied!' : config.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {(Object.keys(NETWORK_CONFIG) as Network[]).map((network) => {
        const config = NETWORK_CONFIG[network];
        const Icon = config.icon;

        return (
        <button
          key={network}
          type="button"
          onClick={() => handleShare(network)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground"
          title={network === 'copy' && copied ? 'Copied!' : config.label}
        >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
