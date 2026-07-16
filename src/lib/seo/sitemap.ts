/**
 * Dynamic Sitemap Generator (W19-T3)
 *
 * Generates XML sitemaps for search engines.
 * Supports static pages and dynamic content (blog posts, pricing).
 */

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

/**
 * Generate sitemap XML for static pages.
 */
export function generateStaticSitemap(): string {
  const entries: SitemapEntry[] = [
    {
      url: '/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: '/pricing',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: '/blog',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: '/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: '/terms',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  return buildSitemapXml(entries);
}

/**
 * Generate sitemap XML for blog posts.
 */
export function generateBlogSitemap(
  posts: Array<{ slug: string; date: string }>
): string {
  const entries: SitemapEntry[] = posts.map((post) => ({
    url: `/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return buildSitemapXml(entries);
}

/**
 * Generate sitemap index XML (links to sub-sitemaps).
 */
export function generateSitemapIndex(): string {
  const sitemaps = [
    { url: `${BASE_URL}/sitemap-static.xml`, lastModified: new Date() },
    { url: `${BASE_URL}/sitemap-blog.xml`, lastModified: new Date() },
  ];

  const entries = sitemaps.map((s) => `  <sitemap>
    <loc>${s.url}</loc>
    <lastmod>${s.lastModified.toISOString()}</lastmod>
  </sitemap>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

/**
 * Build sitemap XML from entries.
 */
function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => `  <url>
    <loc>${BASE_URL}${entry.url}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generate robots.txt content.
 */
export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /api/
Disallow: /auth/

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap-static.xml
Sitemap: ${BASE_URL}/sitemap-blog.xml`;
}
