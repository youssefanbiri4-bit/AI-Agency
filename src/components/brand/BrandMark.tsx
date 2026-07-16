import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface WhiteLabelOverride {
  companyName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  logoAltText?: string | null;
  hideAgentFlowBranding?: boolean;
}

interface BrandMarkProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  tagline?: string;
  inverted?: boolean;
  customLogoUrl?: string | null;
  customLogoAlt?: string | null;
  whiteLabel?: WhiteLabelOverride | null;
  className?: string;
  onClick?: () => void;
}

const sizeStyles = {
  sm: {
    mark: 'h-8 w-8',
    name: 'text-base',
    tagline: 'text-[0.68rem]',
  },
  md: {
    mark: 'h-11 w-11',
    name: 'text-lg',
    tagline: 'text-xs',
  },
  lg: {
    mark: 'h-12 w-12',
    name: 'text-2xl',
    tagline: 'text-xs',
  },
};

function BrandSymbol({ inverted = false }: { inverted?: boolean }) {
  const tileColor = inverted ? '#FFFFFF' : '#5D6B6B';
  const primaryStroke = inverted ? '#5D6B6B' : '#FFFFFF';
  const softStroke = inverted ? '#F7CBCA' : '#D5E5E5';

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-full w-full">
      <rect
        x="2.5"
        y="2.5"
        width="43"
        height="43"
        rx="11"
        fill={tileColor}
      />
      <path
        d="M14.4 34.8L23.8 12.8L33.4 34.8"
        fill="none"
        stroke={primaryStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.3"
      />
      <path
        d="M18.2 27.5H29.6"
        fill="none"
        stroke={softStroke}
        strokeLinecap="round"
        strokeWidth="3.7"
      />
      <path
        d="M11.5 20.4C17.9 11.7 29 9.9 37 16.8"
        fill="none"
        stroke="#F7CBCA"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M34.2 13.1L38.1 17.8L32.5 19.5"
        fill="none"
        stroke="#F7CBCA"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
      <circle cx="23.8" cy="12.8" r="3.8" fill="#F7CBCA" />
      <circle cx="14.4" cy="34.8" r="3.8" fill="#F7CBCA" />
      <circle cx="33.4" cy="34.8" r="3.8" fill="#D5E5E5" />
    </svg>
  );
}

function BrandContent({
  size = 'md',
  showTagline = true,
  tagline = 'Autonomous Agent Operations',
  inverted = false,
  customLogoUrl,
  customLogoAlt,
  whiteLabel,
}: Omit<BrandMarkProps, 'href' | 'className'>) {
  const selectedSize = sizeStyles[size];
  const logoUrl = whiteLabel?.logoUrl ?? customLogoUrl;
  const hasCustomLogo = Boolean(logoUrl);
  const displayName = whiteLabel?.companyName || BRAND_NAME;
  const displayTagline = whiteLabel?.tagline || tagline;
  const altText = whiteLabel?.logoAltText || customLogoAlt || `${displayName} logo`;

  return (
    <>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border p-0.5',
          'shadow-[0_14px_30px_rgba(202,40,81,0.24)]',
          hasCustomLogo ? 'h-10 w-32 max-w-[9rem]' : selectedSize.mark,
          inverted
            ? 'border-white/20 bg-white'
            : 'border-black/10 bg-white'
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={altText}
            className="h-full w-full object-contain"
          />
        ) : (
          <BrandSymbol inverted={inverted} />
        )}
      </span>
      <span className="min-w-0 overflow-hidden">
        <span
          className={cn(
            'block truncate font-black leading-none tracking-normal',
            selectedSize.name,
            inverted ? 'text-white' : 'text-black'
          )}
        >
          {displayName}
        </span>
        {showTagline && (
          <span
            className={cn(
              'mt-1 block truncate font-semibold leading-none',
              selectedSize.tagline,
              inverted ? 'text-white/68' : 'text-black/52'
            )}
          >
            {displayTagline}
          </span>
        )}
      </span>
    </>
  );
}

export function BrandMark({ href, className, onClick, ...props }: BrandMarkProps) {
  const classes = cn('inline-flex min-w-0 max-w-full items-center gap-3', className);

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        <BrandContent {...props} />
      </Link>
    );
  }

  return (
    <span className={classes}>
      <BrandContent {...props} />
    </span>
  );
}
