/**
 * SEO Metadata Helpers
 *
 * Shared constants and utilities for consistent page-level metadata.
 * Ensures all pages have proper title, description, OG, and Twitter tags.
 */

import type { Metadata } from 'next';

const SITE_NAME = 'AgentFlow AI';
const DEFAULT_TITLE = 'AgentFlow AI — AI Agency Operations Platform';
const DEFAULT_DESCRIPTION =
  'A professional AI agency dashboard for managing autonomous agents, tasks, reviews, and workflows. Run AI agency work from one disciplined workspace.';
const DEFAULT_OG_IMAGE = '/og-image.jpg';
const TWITTER_HANDLE = '@agentflowai';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

export interface PageMetadataParams {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  publishedTime?: string;
  authors?: string[];
  tags?: string[];
  noindex?: boolean;
}

/**
 * Generate a complete Metadata object for any page.
 * Includes title, description, OG, Twitter, canonical, and robots.
 */
export function generatePageMetadata({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  publishedTime,
  authors,
  tags,
  noindex = false,
}: PageMetadataParams): Metadata {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const url = `${BASE_URL}${path}`;
  const imageUrl = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
    },
    robots: {
      index: !noindex,
      follow: !noindex,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: ogType,
      locale: 'en_US',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(authors && { authors }),
      ...(tags && { tags }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      site: TWITTER_HANDLE,
      images: [imageUrl],
    },
    other: {
      'application-name': SITE_NAME,
    },
  };
}

/**
 * Default metadata shared across marketing pages.
 */
export const defaultPageMetadata: Metadata = generatePageMetadata({
  title: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  path: '/',
});
