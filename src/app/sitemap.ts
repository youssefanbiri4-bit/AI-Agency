import type { MetadataRoute } from 'next';
import { getBlogPosts } from '@/lib/marketing/blog-data';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

/**
 * Dynamic sitemap generation.
 * Includes all marketing pages and blog posts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/features`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/auth/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  const blogPosts = getBlogPosts();
  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => {
    // Normalize date string to ensure valid Date parsing
    const postDate = new Date(post.date);
    const validDate = isNaN(postDate.getTime()) ? new Date() : postDate;

    return {
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: validDate,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    };
  });

  return [...staticPages, ...blogEntries];
}
