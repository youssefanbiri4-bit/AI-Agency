'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, Search } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import type { DocCategory, DocDifficulty, InternalDoc } from '@/lib/docs/internal-docs';
import { cn } from '@/lib/utils';

const difficultyLabels: Record<DocDifficulty, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
};

export function DocsCenterClient({
  docs,
  categories,
}: {
  docs: InternalDoc[];
  categories: DocCategory[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState<'all' | DocDifficulty>('all');

  const filteredDocs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return docs.filter((doc) => {
      const matchesQuery =
        !normalizedQuery ||
        [doc.title, doc.description, doc.intro, doc.category]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesCategory = category === 'all' || doc.category === category;
      const matchesDifficulty = difficulty === 'all' || doc.difficulty === difficulty;

      return matchesQuery && matchesCategory && matchesDifficulty;
    });
  }, [category, difficulty, docs, query]);

  const featuredDocs = docs.filter((doc) => doc.featured).slice(0, 4);
  const categoryCounts = new Map(categories.map((item) => [item.id, docs.filter((doc) => doc.category === item.id).length]));

  return (
    <div
      dir="rtl"
      className="space-y-8 text-right [font-family:'Cairo',Tajawal,'Noto_Sans_Arabic',sans-serif]"
    >
      <section className="rounded-[28px] border border-black/7 bg-white/90 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">AgentFlow AI Docs</p>
            <h1 className="mt-3 text-4xl font-black tracking-normal text-[#5D6B6B] sm:text-5xl">
              مركز التوثيق الداخلي
            </h1>
            <p className="mt-3 max-w-4xl text-base leading-8 text-black/60">
              دليل تشغيل AgentFlow AI لفهم الوكلاء، المهام، المحتوى، الإعلانات، التقارير، والمشاريع.
            </p>
          </div>
          <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            افتح صحة النظام
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_22px_58px_rgba(93,107,107,0.08)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في التوثيق..."
              className="h-11 w-full rounded-lg border border-black/10 bg-[#F1F7F7]/72 pe-11 ps-4 text-sm font-semibold text-[#5D6B6B] outline-none transition focus:border-[#F7CBCA]/45 focus:ring-4 focus:ring-[#F7CBCA]/12"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-bold text-[#5D6B6B] outline-none focus:border-[#F7CBCA]/45 focus:ring-4 focus:ring-[#F7CBCA]/12"
            aria-label="تصفية حسب التصنيف"
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as 'all' | DocDifficulty)}
            className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-bold text-[#5D6B6B] outline-none focus:border-[#F7CBCA]/45 focus:ring-4 focus:ring-[#F7CBCA]/12"
            aria-label="تصفية حسب المستوى"
          >
            <option value="all">كل المستويات</option>
            <option value="beginner">مبتدئ</option>
            <option value="intermediate">متوسط</option>
            <option value="advanced">متقدم</option>
          </select>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#5D6B6B]">التصنيفات</h2>
          <span className="text-sm font-bold text-black/45">{docs.length} مقال</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((item) => {
            const selected = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(selected ? 'all' : item.id)}
                className={cn(
                  'rounded-2xl border p-4 text-right shadow-sm transition hover:-translate-y-0.5',
                  selected
                    ? 'border-[#F7CBCA]/28 bg-[#D5E5E5]/72 text-[#5D6B6B]'
                    : 'border-black/7 bg-white/88 hover:border-[#F7CBCA]/22'
                )}
              >
                <p className="font-black text-[#5D6B6B]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-black/56">{item.description}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[#F7CBCA]">
                  {categoryCounts.get(item.id) ?? 0} مقال
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {featuredDocs.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-black text-[#5D6B6B]">أدلة مقترحة</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredDocs.map((doc) => (
              <DocCard key={doc.slug} doc={doc} categories={categories} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#5D6B6B]">كل المقالات</h2>
          <span className="text-sm font-bold text-black/45">{filteredDocs.length} نتيجة</span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/12 bg-white p-8 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-[#F7CBCA]" />
            <h3 className="mt-4 text-xl font-black text-[#5D6B6B]">لم يتم العثور على نتائج</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-black/58">
              جرّب كلمة أخرى أو اختر تصنيفاً مختلفاً.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDocs.map((doc) => (
              <DocCard key={doc.slug} doc={doc} categories={categories} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DocCard({ doc, categories }: { doc: InternalDoc; categories: DocCategory[] }) {
  const category = categories.find((item) => item.id === doc.category);

  return (
    <article className="flex min-h-full flex-col rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#F7CBCA]/14 bg-[#F1F7F7] px-2.5 py-1 text-xs font-black text-[#F7CBCA]">
          {category?.title ?? doc.category}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-bold text-black/55">
          {difficultyLabels[doc.difficulty]}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-black leading-7 text-[#5D6B6B]">{doc.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-7 text-black/58">{doc.description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-black/45">
        <Clock className="h-4 w-4" />
        {doc.readTime}
      </div>
      <Link href={`/dashboard/docs/${doc.slug}`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4 w-full' })}>
        Open Guide
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </article>
  );
}
