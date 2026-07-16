import type { Metadata } from 'next';
import Link from 'next/link';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { ArrowRight, Calendar, Sparkles, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { SectionHeader } from '@/components/marketing/SectionHeader';
import { getBlogPosts } from '@/lib/marketing/blog-data';

export const metadata: Metadata = generatePageMetadata({
  title: 'Blog — AI Agency Operations Guides & Insights',
  description:
    'Guides, best practices, and deep dives into running AI-powered agency workflows. Learn about AI agent operations, content studio, RBAC security, and more.',
  path: '/blog',
});

export default function BlogPage() {
  const posts = getBlogPosts();

  const categories = Array.from(new Set(posts.map((p) => p.category)));

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'AgentFlow AI Blog',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agentflow-ai.vercel.app'}/blog`,
    description: 'Guides, best practices, and deep dives into running AI-powered agency workflows.',
  };

  return (
    <div className="dashboard-background premium-page min-h-screen w-full text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <MarketingNavbar />

      <main className="w-full">
        {/* Hero */}
        <section className="relative border-b border-black/8">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge tone="brand" className="mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                Blog & Insights
              </Badge>
              <h1 className="text-4xl font-black tracking-normal text-black sm:text-5xl lg:text-6xl">
                AI agency operations, explained
              </h1>
              <p className="mt-4 text-base leading-7 text-black/62 sm:text-lg sm:leading-8">
                Guides, best practices, and deep dives into running AI-powered agency workflows.
              </p>
            </div>
          </div>
        </section>

        {/* Categories filter */}
        <div className="border-b border-black/8 bg-white/40">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-4 sm:px-6 lg:px-8">
            {categories.map((cat) => (
              <span
                key={cat}
                className="shrink-0 rounded-full border border-[#F7CBCA]/20 bg-white px-4 py-1.5 text-xs font-bold text-[#F7CBCA]"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Featured post */}
        {posts.length > 0 && (
          <section className="border-b border-black/8 py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
              <Link
                href={`/blog/${posts[0].slug}`}
                className="group grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center"
              >
                <div className="overflow-hidden rounded-2xl border border-black/8 bg-gradient-to-br from-[#F1F7F7] to-white p-8 sm:p-12 lg:p-16">
                  <Badge tone="accent" className="mb-4">
                    Featured
                  </Badge>
                  <h2 className="text-2xl font-black text-black sm:text-3xl lg:text-4xl group-hover:text-[#F7CBCA] transition-colors">
                    {posts[0].title}
                  </h2>
                  <p className="mt-4 text-base leading-7 text-black/62 line-clamp-2">
                    {posts[0].excerpt}
                  </p>
                  <div className="mt-6 flex items-center gap-4 text-sm text-black/46">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {posts[0].date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {posts[0].readTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      {posts[0].author}
                    </span>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#F7CBCA] group-hover:underline">
                    Read article <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="hidden lg:block">
                  <div className="rounded-2xl border border-black/8 bg-white/70 p-8">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">Category</p>
                    <p className="mt-2 text-lg font-bold text-black">{posts[0].category}</p>
                    <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {posts[0].tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-black/8 bg-white px-2.5 py-1 text-xs font-medium text-black/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* All posts */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="All articles"
              title="Latest from AgentFlow AI"
              description="Stay updated with the latest strategies, tips, and product updates."
            />

            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(1).map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-2xl border border-black/8 bg-white/70 p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-[#F7CBCA]/20"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-md bg-[#D5E5E5]/40 px-2.5 py-0.5 text-xs font-bold text-[#F7CBCA]">
                      {post.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-black group-hover:text-[#F7CBCA] transition-colors">
                    {post.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-black/54 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-black/46">
                    <span>{post.date}</span>
                    <span>·</span>
                    <span>{post.readTime}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="px-5 pb-24 sm:px-6 sm:pb-28 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border border-[#F7CBCA]/12 bg-[#5D6B6B]/72 p-8 text-white shadow-[0_30px_80px_rgba(93,107,107,0.18)] sm:p-10 lg:p-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-3xl font-black tracking-normal sm:text-4xl">
                  Get the latest insights
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/68">
                  Subscribe to our newsletter for AI agency operations guides, product updates, and best practices.
                </p>
              </div>
              <Link href="/auth/signup" className={buttonStyles({ variant: 'secondary', size: 'lg', className: 'h-12 px-6' })}>
                Subscribe
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
