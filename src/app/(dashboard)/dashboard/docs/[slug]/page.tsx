import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock } from 'lucide-react';
import {
  getDocBySlug,
  getDocCategory,
  getRelatedDocs,
  internalDocs,
  type DocCallout,
  type DocDifficulty,
  type InternalDoc,
} from '@/lib/docs/internal-docs';
import { buttonStyles } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { DocCopyButton } from '../DocCopyButton';

const difficultyLabels: Record<DocDifficulty, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
};

const calloutStyles: Record<DocCallout['tone'], string> = {
  warning: 'border-[#F7CBCA]/24 bg-[#F7CBCA]/10 text-[#B51F30]',
  tip: 'border-[#E7F5DC]/34 bg-[#E7F5DC]/18 text-[#8A4300]',
  important: 'border-[#F7CBCA]/22 bg-[#D5E5E5]/60 text-[#F7CBCA]',
};

export function generateStaticParams() {
  return internalDocs.map((doc) => ({ slug: doc.slug }));
}

function buildArticleText(doc: InternalDoc) {
  return [
    `# ${doc.title}`,
    '',
    doc.description,
    '',
    '## الخطوات',
    ...doc.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## أمثلة عملية',
    ...doc.examples.map((example) => `- ${example}`),
    '',
    '## قائمة التحقق',
    ...doc.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## تنبيهات',
    ...doc.callouts.map((callout) => `- ${callout.title}: ${callout.body}`),
  ].join('\n');
}

function buildChecklistText(doc: InternalDoc) {
  return [`# قائمة تحقق: ${doc.title}`, ...doc.checklist.map((item) => `- [ ] ${item}`)].join('\n');
}

function buildQuickStepsText(doc: InternalDoc) {
  return [`# خطوات سريعة: ${doc.title}`, ...doc.steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
}

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const category = getDocCategory(doc.category);
  const relatedDocs = getRelatedDocs(doc);
  const tableOfContents = [
    ['intro', 'نظرة عامة'],
    ['steps', 'الخطوات'],
    ['examples', 'أمثلة عملية'],
    ['checklist', 'قائمة التحقق'],
    ['related', 'روابط ذات صلة'],
  ] as const;

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div
        dir="rtl"
        className="mx-auto max-w-[1320px] space-y-6 text-right"
        style={{ fontFamily: 'Cairo, Tajawal, "Noto Sans Arabic", sans-serif' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/docs" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            <ArrowRight className="h-4 w-4" />
            العودة إلى مركز التوثيق
          </Link>
          <div className="flex flex-wrap gap-2">
            <DocCopyButton text={buildArticleText(doc)} label="Copy Article" />
            <DocCopyButton text={buildChecklistText(doc)} label="Copy Checklist" />
            <DocCopyButton text={buildQuickStepsText(doc)} label="Copy Quick Steps" />
          </div>
        </div>

        <section className="rounded-[28px] border border-black/7 bg-white/92 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#F7CBCA]/14 bg-[#F1F7F7] px-3 py-1 text-xs font-black text-[#F7CBCA]">
                  {category?.title ?? doc.category}
                </span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-bold text-black/55">
                  {difficultyLabels[doc.difficulty]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-bold text-black/55">
                  <Clock className="h-3.5 w-3.5" />
                  {doc.readTime}
                </span>
              </div>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal text-[#5D6B6B] sm:text-5xl">
                {doc.title}
              </h1>
              <p className="mt-3 max-w-4xl text-base leading-8 text-black/60">{doc.description}</p>
            </div>
            <BookOpen className="hidden h-12 w-12 text-[#F7CBCA] xl:block" />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)] xl:sticky xl:top-28">
            <h2 className="font-black text-[#5D6B6B]">محتويات الدليل</h2>
            <nav className="mt-4 space-y-2">
              {tableOfContents.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-lg px-3 py-2 text-sm font-bold text-black/58 transition hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]"
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="space-y-6">
            <DocSection id="intro" title="نظرة عامة">
              <p className="text-base leading-8 text-black/64">{doc.intro}</p>
              {doc.callouts.map((callout) => (
                <div key={`${callout.title}-${callout.body}`} className={cn('mt-4 rounded-2xl border p-4', calloutStyles[callout.tone])}>
                  <p className="font-black">{callout.title}</p>
                  <p className="mt-1 text-sm leading-7">{callout.body}</p>
                </div>
              ))}
            </DocSection>

            <DocSection id="steps" title="الخطوات">
              <ol className="space-y-3">
                {doc.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7CBCA] text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-sm leading-7 text-black/64">{step}</span>
                  </li>
                ))}
              </ol>
            </DocSection>

            <DocSection id="examples" title="أمثلة عملية">
              <div className="grid gap-3 md:grid-cols-2">
                {doc.examples.map((example) => (
                  <div key={example} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                    <p className="text-sm leading-7 text-black/64">{example}</p>
                  </div>
                ))}
              </div>
            </DocSection>

            <DocSection id="checklist" title="قائمة التحقق">
              <div className="space-y-3">
                {doc.checklist.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-black/7 bg-white p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F7CBCA]" />
                    <p className="text-sm font-bold leading-7 text-black/65">{item}</p>
                  </div>
                ))}
              </div>
            </DocSection>

            <DocSection id="related" title="روابط ذات صلة">
              <div className="grid gap-3 md:grid-cols-2">
                {doc.relatedLinks.map((link) => (
                  <Link key={`${link.href}-${link.label}`} href={link.href} className={buttonStyles({ variant: 'outline', className: 'justify-between' })}>
                    {link.label}
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                ))}
              </div>
              {relatedDocs.length > 0 ? (
                <div className="mt-5">
                  <h3 className="mb-3 font-black text-[#5D6B6B]">مقالات من نفس التصنيف</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {relatedDocs.map((item) => (
                      <Link key={item.slug} href={`/dashboard/docs/${item.slug}`} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4 hover:bg-white">
                        <p className="font-black leading-7 text-[#5D6B6B]">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-black/56">{item.description}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </DocSection>
          </article>
        </div>
      </div>
    </div>
  );
}

function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)]">
      <h2 className="mb-4 text-xl font-black text-[#5D6B6B]">{title}</h2>
      {children}
    </section>
  );
}
