import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, User, Tag } from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { getBlogPost } from '@/lib/marketing/blog-data';
import { generateBlogPostStructuredData, serializeStructuredData } from '@/lib/seo/structured-data';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {};
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai-sigma.vercel.app';

  // Root layout title template (%s | AgentFlow AI) adds branding automatically.
  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: `${post.title} — AgentFlow AI Blog`,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} — AgentFlow AI Blog`,
      description: post.excerpt,
      images: [`${baseUrl}/og-image.jpg`],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const structuredData = generateBlogPostStructuredData({
    title: post.title,
    excerpt: post.excerpt,
    slug: post.slug,
    date: post.date,
    author: post.author,
    category: post.category,
  });

  const lines = post.content.split('\n');
  const contentHtml = lines
    .map((line) => {
      if (line.startsWith('## ')) {
        return `<h2 class="mt-10 mb-4 text-2xl font-black text-black">${line.slice(3)}</h2>`;
      }
      if (line.startsWith('### ')) {
        return `<h3 class="mt-6 mb-3 text-xl font-bold text-black">${line.slice(4)}</h3>`;
      }
      if (line.startsWith('- **')) {
        const boldMatch = line.match(/^- \*\*(.+?)\*\*(.*)$/);
        if (boldMatch) {
          return `<li class="ml-4 text-base leading-7 text-black/72"><strong>${boldMatch[1]}</strong>${boldMatch[2]}</li>`;
        }
        return `<li class="ml-4 text-base leading-7 text-black/72">${line.slice(2)}</li>`;
      }
      if (line.startsWith('- ')) {
        return `<li class="ml-4 text-base leading-7 text-black/72">${line.slice(2)}</li>`;
      }
      if (line.startsWith('1. ')) {
        return `<li class="ml-4 text-base leading-7 text-black/72 list-decimal">${line.slice(3)}</li>`;
      }
      if (line.startsWith('```')) {
        return ''; // Skip code fence markers
      }
      if (line.trim() === '') {
        return '<div class="h-4"></div>';
      }
      return `<p class="text-base leading-7 text-black/72">${line}</p>`;
    })
    .join('\n');

  return (
    <div className="dashboard-background premium-page min-h-screen w-full text-black">
      <MarketingNavbar />

      <main className="w-full">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          {/* Back link */}
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-black/50 hover:text-[#F7CBCA] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-md bg-[#D5E5E5]/40 px-3 py-1 text-xs font-bold text-[#F7CBCA]">
                {post.category}
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-normal text-black sm:text-4xl lg:text-5xl">
              {post.title}
            </h1>

            <p className="mt-4 text-lg leading-7 text-black/54">
              {post.excerpt}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-black/46">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {post.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {post.readTime}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.author}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-md border border-black/8 bg-white px-2.5 py-1 text-xs font-medium text-black/60"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          </header>

          {/* Content */}
          <div
            className="prose-custom"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* JSON-LD Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeStructuredData(structuredData),
            }}
          />

          {/* Footer */}
          <footer className="mt-16 border-t border-black/8 pt-8">
            <div className="rounded-2xl border border-[#F7CBCA]/12 bg-[#5D6B6B]/72 p-6 text-white sm:p-8">
              <h3 className="text-xl font-black">Enjoyed this article?</h3>
              <p className="mt-2 text-sm text-white/68">
                Subscribe to our newsletter for more insights on AI agency operations, product updates, and best practices.
              </p>
              <Link
                href="/auth/signup"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-[#5D6B6B] hover:bg-white/90 transition-colors"
              >
                Subscribe Now
              </Link>
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
