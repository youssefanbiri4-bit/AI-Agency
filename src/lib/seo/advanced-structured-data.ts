/**
 * Advanced Structured Data Generators (W19-T3)
 *
 * Extended JSON-LD schema.org generators for:
 * - FAQ pages
 * - How-to guides
 * - Software applications
 * - Product reviews
 * - Event tracking
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
  url?: string;
}

export interface SoftwareApp {
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
  };
}

/**
 * Generate FAQ structured data for FAQ sections.
 */
export function generateFAQStructuredData(
  faqs: FAQItem[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate HowTo structured data for step-by-step guides.
 */
export function generateHowToStructuredData(
  name: string,
  description: string,
  steps: HowToStep[],
  totalTime?: string
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    totalTime: totalTime || `PT${steps.length * 5}M`,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
      ...(step.url ? { url: `${baseUrl}${step.url}` } : {}),
    })),
  };
}

/**
 * Generate SoftwareApplication structured data.
 */
export function generateSoftwareAppStructuredData(
  app: SoftwareApp
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: app.description,
    url: app.url,
    applicationCategory: app.applicationCategory,
    operatingSystem: app.operatingSystem,
    ...(app.offers
      ? {
          offers: {
            '@type': 'Offer',
            price: app.offers.price,
            priceCurrency: app.offers.priceCurrency,
          },
        }
      : {}),
    ...(app.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: app.aggregateRating.ratingValue,
            reviewCount: app.aggregateRating.reviewCount,
            bestRating: app.aggregateRating.bestRating || 5,
          },
        }
      : {}),
  };
}

/**
 * Generate Product structured data for pricing pages.
 */
export function generateProductStructuredData(
  name: string,
  description: string,
  price: string,
  priceCurrency: string,
  features: string[]
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: `${baseUrl}/pricing`,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency,
      availability: 'https://schema.org/InStock',
    },
    featureList: features,
  };
}

/**
 * Generate Event structured data for webinars/demos.
 */
export function generateEventStructuredData(
  name: string,
  description: string,
  startDate: string,
  endDate: string,
  location: string,
  url: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    startDate,
    endDate,
    location: {
      '@type': 'VirtualLocation',
      url,
    },
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Organization',
      name: 'AgentFlow AI',
      url: process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app',
    },
  };
}
