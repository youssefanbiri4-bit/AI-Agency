/**
 * Social Sharing Helpers (W16-T2)
 *
 * Builds shareable URLs for the major networks and a canonical share payload
 * used by the referral + marketing surfaces.
 */

export interface SharePayload {
  url: string;
  title: string;
  text?: string;
}

export function buildShareUrl(network: 'twitter' | 'linkedin' | 'facebook' | 'email', payload: SharePayload): string {
  const { url, title, text } = payload;
  switch (network) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text ?? title)}&url=${encodeURIComponent(url)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text ?? ''} ${url}`)}`;
    default:
      return url;
  }
}

/**
 * Open Graph / Twitter meta tags for manual injection (e.g. on custom pages
 * that cannot use the Next metadata API). Returns a flat attribute map.
 */
export function buildSocialMetaTags(opts: {
  title: string;
  description: string;
  url: string;
  image?: string;
}): Record<string, string> {
  const image = opts.image ?? '/og-image.jpg';
  return {
    'og:title': opts.title,
    'og:description': opts.description,
    'og:url': opts.url,
    'og:type': 'website',
    'og:image': image,
    'twitter:card': 'summary_large_image',
    'twitter:title': opts.title,
    'twitter:description': opts.description,
    'twitter:image': image,
  };
}
