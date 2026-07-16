/**
 * Structured Data (JSON-LD) Generation
 *
 * Generates schema.org-compatible JSON-LD for SEO optimization.
 * All schemas follow the recommended Google structured data guidelines.
 */

function normalizeDateToISO(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export interface OrganizationSchema {
  name: string;
  description: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

export interface WebSiteSchema {
  name: string;
  description: string;
  url: string;
  searchAction?: {
    target: string;
    queryInput: string;
  };
}

export interface WebApplicationSchema {
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  browserRequirements?: string;
  offers?: {
    price: string;
    priceCurrency: string;
    description: string;
  };
}

export interface BlogPostingSchema {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  author: {
    name: string;
    url?: string;
  };
  image?: string;
  publisher: {
    name: string;
    logo?: string;
  };
}

const DEFAULT_ORG: OrganizationSchema = {
  name: 'AgentFlow AI',
  description: 'AI agency operations platform for managing autonomous agents, tasks, reviews, and workflows.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app',
};

/**
 * Generate the base @graph array for the root layout.
 * Includes Organization, WebSite, and WebApplication schemas.
 */
export function generateBaseStructuredData(): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: DEFAULT_ORG.name,
        description: DEFAULT_ORG.description,
        url: baseUrl,
        logo: `${baseUrl}/logo-marketing.svg`,
        sameAs: [],
      },
      {
        '@type': 'WebSite',
        name: 'AgentFlow AI',
        description: DEFAULT_ORG.description,
        url: baseUrl,
      },
      {
        '@type': 'WebApplication',
        name: 'AgentFlow AI',
        description: 'Run AI agency work from one disciplined workspace',
        url: baseUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires modern browser (Chrome, Firefox, Safari, Edge)',
      },
    ],
  };
}

/**
 * Generate a BlogPosting schema for blog articles.
 */
export function generateBlogPostStructuredData(
  post: {
    title: string;
    excerpt: string;
    slug: string;
    date: string;
    author: string;
    category: string;
  },
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    datePublished: normalizeDateToISO(post.date),
    dateModified: normalizeDateToISO(post.date),
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AgentFlow AI',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo-marketing.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${post.slug}`,
    },
    image: `${baseUrl}/og-image.jpg`,
    articleSection: post.category,
  };
}

/**
 * Generate BreadcrumbList structured data.
 */
export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * Serialize structured data to a JSON-LD script tag string.
 */
export function serializeStructuredData(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 0);
}
