'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import type {
  ContentStudioPlatform,
  ContentStudioStatus,
} from '@/types/database';

type ItemSource = 'content' | 'release' | 'reel';

export interface CalendarContentItem {
  id: string;
  title: string;
  platform: ContentStudioPlatform;
  content_type: string;
  status: ContentStudioStatus | 'published';
  provider_status: string | null;
  schedule_at: string | null;
  provider_error: string | null;
  source: ItemSource;
}

type FilterType = 'all' | 'content' | 'release' | 'reel';
type StatusFilterValue = 'all' | ContentStudioStatus | 'published';

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_SHORT_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function useLiveClock() {
  const [clock, setClock] = useState<string>('');
  const [dayName, setDayName] = useState<string>('');
  const [fullDate, setFullDate] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(now)
      );
      setDayName(
        new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(now)
      );
      setFullDate(
        new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(now)
      );
      setTimezone(
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { clock, dayName, fullDate, timezone };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  return startOfDay(addDays(date, -day));
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function monthGridDays(anchorDate: Date) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getItemDate(item: CalendarContentItem) {
  return item.schedule_at ? new Date(item.schedule_at) : null;
}

function getCalendarStatus(item: CalendarContentItem): string {
  if (item.source === 'release') return item.status;
  if (item.source === 'reel') return item.status || 'scheduled';
  return item.provider_status === 'manual_only' ? 'manual_only' : item.status;
}

function getTimeLabel(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function formatMonthTitle(date: Date, isRtl: boolean) {
  try {
    return new Intl.DateTimeFormat(isRtl ? 'ar' : undefined, {
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
}

function formatDayTitle(date: Date, isRtl: boolean) {
  try {
    return new Intl.DateTimeFormat(isRtl ? 'ar' : undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

const statusDotColors: Record<string, string> = {
  completed: 'bg-green-500',
  published: 'bg-green-500',
  ready: 'bg-purple-500',
  scheduled: 'bg-purple-500',
  draft: 'bg-amber-400',
  failed: 'bg-red-500',
  setup_required: 'bg-red-400',
  approval_pending: 'bg-orange-400',
  needs_review: 'bg-blue-400',
  pending: 'bg-blue-400',
  processing: 'bg-blue-400',
};

type CalendarClientProps = {
  items: CalendarContentItem[];
};

export function CalendarClient({ items }: CalendarClientProps) {
  const clock = useLiveClock();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const { dir: languageDir } = useLanguage();
  const isRtl = languageDir === 'rtl';

  const monthDays = useMemo(() => monthGridDays(anchorDate), [anchorDate]);
  const currentMonth = anchorDate.getMonth();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.schedule_at) return false;
      if (typeFilter !== 'all' && item.source !== typeFilter) return false;
      if (statusFilter !== 'all' && getCalendarStatus(item) !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => Date.parse(a.schedule_at ?? '') - Date.parse(b.schedule_at ?? ''));
  }, [items, typeFilter, statusFilter, searchQuery]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarContentItem[]>();
    for (const item of filteredItems) {
      const d = getItemDate(item);
      if (!d) continue;
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  function itemsForDay(day: Date) {
    return itemsByDay.get(day.toDateString()) ?? [];
  }

  const selectedItems = selectedDay ? itemsForDay(selectedDay) : [];

  const moveMonth = useCallback((delta: number) => {
    setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDay(null);
  }, []);

  const goToday = useCallback(() => {
    const now = startOfDay(new Date());
    setAnchorDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  }, []);

  const statusCounts = useMemo(() => countBy(items.map((i) => i.status)), [items]);
  const sourceCounts = useMemo(() => countBy(items.map((i) => i.source)), [items]);
  const totalScheduled = items.filter((i) => i.status === 'scheduled').length;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setSelectedDay(null);
      }
    }
    if (selectedDay) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [selectedDay]);

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="rounded-3xl border border-black/6 bg-white/92 p-5 shadow-[0_24px_64px_rgba(93,107,107,0.07)] ring-1 ring-white/70 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: icon + month/year */}
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_8px_24px_rgba(202,40,81,0.25)]">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl font-black text-[#5D6B6B] sm:text-3xl">
                  {formatMonthTitle(anchorDate, isRtl)}
                </h1>
                {clock.clock ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-[#F1F7F7] px-3 py-1 text-xs font-bold text-black/55">
                    <Clock className="h-3.5 w-3.5" />
                    {clock.clock}
                  </span>
                ) : (
                  <span className="inline-flex h-7 w-16 animate-pulse rounded-full bg-black/5" />
                )}
              </div>
              {clock.dayName ? (
                <p className="mt-1 text-sm font-medium text-black/50">
                  {clock.dayName} &middot; {clock.fullDate} &middot; {clock.timezone}
                </p>
              ) : (
                <p className="mt-1 h-5 w-64 animate-pulse rounded bg-black/5" />
              )}
            </div>
          </div>

          {/* Right: navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth(isRtl ? 1 : -1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/8 bg-white text-black/55 shadow-sm transition hover:border-[#F7CBCA]/25 hover:text-[#F7CBCA]"
              aria-label={isRtl ? 'Next month' : 'Previous month'}
            >
              <ChevronLeft className={cn('h-4 w-4', isRtl && 'rotate-180')} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#F7CBCA]/14 bg-[#F1F7F7] px-3 text-xs font-bold text-[#F7CBCA] shadow-sm transition hover:bg-[#D5E5E5]/60"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => moveMonth(isRtl ? -1 : 1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/8 bg-white text-black/55 shadow-sm transition hover:border-[#F7CBCA]/25 hover:text-[#F7CBCA]"
              aria-label={isRtl ? 'Previous month' : 'Next month'}
            >
              <ChevronRight className={cn('h-4 w-4', isRtl && 'rotate-180')} />
            </button>
            <div className="ms-2 hidden h-8 w-px bg-black/8 sm:block" />
            <Link
              href="/dashboard/content-studio"
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              Open Content Studio
            </Link>
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="h-9 w-full rounded-xl border border-black/8 bg-white ps-3 pe-8 text-sm font-medium text-black outline-none transition focus:border-[#F7CBCA]/35 focus:ring-4 focus:ring-[#F7CBCA]/10"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-black/35 hover:text-[#F7CBCA]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'all', label: 'All' },
              { value: 'content', label: `Content (${sourceCounts.content ?? 0})` },
              { value: 'release', label: `Releases (${sourceCounts.release ?? 0})` },
              { value: 'reel', label: `Reels (${sourceCounts.reel ?? 0})` },
            ] as const).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                  typeFilter === f.value
                    ? 'border-[#F7CBCA]/25 bg-[#F7CBCA] text-white shadow-sm'
                    : 'border-black/8 bg-white text-black/55 hover:border-[#F7CBCA]/20 hover:text-[#F7CBCA]'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'all', label: 'Any status' },
              { value: 'scheduled', label: `Scheduled (${statusCounts.scheduled ?? 0})` },
              { value: 'draft', label: `Draft (${statusCounts.draft ?? 0})` },
              { value: 'published', label: `Published (${statusCounts.published ?? 0})` },
              { value: 'failed', label: `Failed (${(statusCounts.failed ?? 0) + (statusCounts.setup_required ?? 0)})` },
            ] as const).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value as StatusFilterValue)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                  statusFilter === f.value
                    ? 'border-[#F7CBCA]/25 bg-[#F7CBCA] text-white shadow-sm'
                    : 'border-black/8 bg-white text-black/55 hover:border-[#F7CBCA]/20 hover:text-[#F7CBCA]'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {(typeFilter !== 'all' || statusFilter !== 'all' || searchQuery) ? (
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearchQuery(''); }}
              className="inline-flex items-center gap-1 rounded-xl border border-black/8 bg-white px-3 py-1.5 text-xs font-bold text-black/45 transition hover:text-[#F7CBCA]"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>

        {/* Stat chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/7 bg-[#F1F7F7]/80 px-3 py-1 text-xs font-bold text-black/55">
            <CalendarDays className="h-3.5 w-3.5 text-[#F7CBCA]" />
            {filteredItems.length} items
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/7 bg-[#F1F7F7]/80 px-3 py-1 text-xs font-bold text-black/55">
            <Clock className="h-3.5 w-3.5 text-purple-500" />
            {totalScheduled} scheduled
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/7 bg-[#F1F7F7]/80 px-3 py-1 text-xs font-bold text-black/55">
            <Filter className="h-3.5 w-3.5 text-[#F7CBCA]" />
            {items.length} total planned
          </span>
        </div>
      </div>

      {/* Weekday header */}
      <div className="hidden sm:grid sm:grid-cols-7 sm:gap-2">
        {(isRtl ? [...WEEKDAYS_SHORT_AR].reverse() : WEEKDAYS_SHORT).map((day) => (
          <div
            key={day}
            className="rounded-2xl px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-black/40"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month grid */}
      {filteredItems.length === 0 && typeFilter === 'all' && statusFilter === 'all' && !searchQuery ? (
        <div className="rounded-3xl border border-black/6 bg-white/88 p-12 text-center shadow-[0_20px_54px_rgba(93,107,107,0.06)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F7F7] text-[#F7CBCA]">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-xl font-black text-[#5D6B6B]">No calendar items yet</h3>
          <p className="mt-2 text-sm leading-6 text-black/55">Schedule content from Content Studio to see it here.</p>
          <Link
            href="/dashboard/content-studio"
            className={buttonStyles({ variant: 'secondary', className: 'mt-5' })}
          >
            Open Content Studio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {monthDays.map((day) => {
            const dayItems = itemsForDay(day);
            const inMonth = day.getMonth() === currentMonth;
            const isToday = sameDay(day, today);
            const isSelected = selectedDay ? sameDay(day, selectedDay) : false;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(selectedDay && isSelected ? null : day)}
                className={cn(
                  'group relative flex min-h-[80px] w-full flex-col rounded-2xl border p-2 text-left transition-all duration-200 sm:min-h-[110px] sm:p-3',
                  'hover:-translate-y-0.5 hover:shadow-lg',
                  !inMonth && 'opacity-35',
                  isSelected
                    ? 'border-[#F7CBCA]/30 bg-gradient-to-br from-[#F7CBCA]/8 to-[#F7CBCA]/5 shadow-[0_8px_28px_rgba(202,40,81,0.14)] ring-2 ring-[#F7CBCA]/20'
                    : isToday
                      ? 'border-[#F7CBCA]/25 bg-[#D5E5E5]/35 shadow-sm'
                      : dayItems.length > 0
                        ? 'border-black/8 bg-white/85 shadow-sm'
                        : 'border-black/5 bg-white/60'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm font-black transition',
                      isSelected && 'bg-[#F7CBCA] text-white shadow-sm',
                      isToday && !isSelected && 'bg-[#F7CBCA] text-white shadow-sm',
                      !isToday && !isSelected && 'text-[#5D6B6B]'
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {dayItems.length > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F7CBCA]/10 px-1.5 text-[10px] font-black text-[#F7CBCA]">
                      {dayItems.length}
                    </span>
                  ) : null}
                </div>

                {/* Item previews (max 2) */}
                <div className="mt-1.5 hidden space-y-1 sm:block">
                  {dayItems.slice(0, 2).map((item) => {
                    const dotColor = statusDotColors[item.status] || 'bg-gray-400';
                    return (
                      <div
                        key={item.id}
                        className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-bold leading-tight text-black/65 transition group-hover:bg-black/[0.03]"
                      >
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColor)} />
                        <span className="min-w-0 truncate">{item.title}</span>
                        {getTimeLabel(item.schedule_at) ? (
                          <span className="shrink-0 text-[10px] text-black/40">
                            {getTimeLabel(item.schedule_at)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {dayItems.length > 2 ? (
                    <p className="px-1.5 text-[10px] font-bold text-[#F7CBCA]">
                      +{dayItems.length - 2} more
                    </p>
                  ) : null}
                </div>

                {/* Mobile: just show count */}
                <div className="mt-auto flex flex-wrap gap-1 sm:hidden">
                  {dayItems.slice(0, 3).map((item) => {
                    const dotColor = statusDotColors[item.status] || 'bg-gray-400';
                    return (
                      <span
                        key={item.id}
                        className={cn('h-1.5 w-1.5 rounded-full', dotColor)}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Day detail popover */}
      {selectedDay ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[1px] sm:hidden" onClick={() => setSelectedDay(null)} />
          <div
            ref={popoverRef}
            className={cn(
              'fixed bottom-0 start-0 end-0 z-40 rounded-t-3xl border border-black/6 bg-white/95 p-5 shadow-[0_-12px_48px_rgba(93,107,107,0.12)] backdrop-blur-xl transition-all sm:static sm:rounded-3xl sm:border sm:bg-white/90 sm:p-6 sm:shadow-[0_20px_54px_rgba(93,107,107,0.07)]'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#5D6B6B]">
                  {formatDayTitle(selectedDay, isRtl)}
                </h2>
                <p className="mt-1 text-sm font-medium text-black/50">
                  {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} on this day
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/8 bg-white text-black/45 transition hover:text-[#F7CBCA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedItems.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-black/8 bg-[#F1F7F7]/60 p-6 text-center">
                <p className="text-sm font-bold text-black/50">No scheduled items on this day</p>
                <Link
                  href="/dashboard/content-studio"
                  className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-3' })}
                >
                  Open Content Studio
                </Link>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {selectedItems.map((item) => {
                  const dotColor = statusDotColors[item.status] || 'bg-gray-400';
                  return (
                    <Link
                      key={item.id}
                      href={
                        item.source === 'release'
                          ? `/dashboard/releases/${item.id}`
                          : item.source === 'reel'
                            ? `/dashboard/reels/${item.id}`
                            : `/dashboard/content-studio?item=${item.id}`
                      }
                      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 transition hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', dotColor)} />
                        <div className="min-w-0">
                          <p className="break-words font-bold text-[#5D6B6B]">{item.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-black/50">
                            <span>{item.platform}</span>
                            {getTimeLabel(item.schedule_at) ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getTimeLabel(item.schedule_at)}
                              </span>
                            ) : null}
                            <span className="capitalize">{item.source}</span>
                          </div>
                          {item.provider_error ? (
                            <p className="mt-1 text-xs font-medium text-red-500">{item.provider_error}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={item.status as Parameters<typeof StatusBadge>[0]['status']} type="task" size="sm" />
                        <span className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                          Open
                          <ExternalLink className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
