'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Copy,
  DatabaseBackup,
  FolderKanban,
  Gauge,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  PenSquare,
  RadioTower,
  RefreshCw,
  Send,
  Trash2,
  BookMarked,
  Settings,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';

interface OpenAIStatus {
  keyPresent: boolean;
  model: string;
  status: 'ready' | 'setup_required' | 'error';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface HistoryEntry {
  role: string;
  content: string;
}

const quickPrompts = [
  'شنو خاصني ندير اليوم؟',
  'وريني المشاكل ديال المزودات',
  'لخص ليا صحة النظام',
  'حضر ليا خطة محتوى أسبوعية',
  'خطط ليا حملة إنستغرام',
  'شرح ليا كيفاش نخدم بـ 18 Agent',
  'عطيني خطة إصلاح للموقع',
  'Summarize my projects',
  'Create a safe patch plan',
  'Review provider blockers',
];

const actionLinks = [
  { label: 'Open Content Studio', href: '/dashboard/content-studio', icon: PenSquare },
  { label: 'Open Projects', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Open System Health', href: '/dashboard/system-health', icon: Gauge },
  { label: 'Open Security', href: '/dashboard/security', icon: LockKeyhole },
  { label: 'Open Backups', href: '/dashboard/backups', icon: DatabaseBackup },
  { label: 'Open Docs', href: '/dashboard/docs', icon: BookMarked },
  { label: 'Open Provider Setup', href: '/dashboard/settings#provider-setup-wizard', icon: Settings },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AlexChatClient({ openAIStatus }: { openAIStatus: OpenAIStatus }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: openAIStatus.status === 'ready'
        ? 'Hello! I\'m Alex, your personal agency assistant. How can I help you today?'
        : 'OpenAI API key is missing. Add OPENAI_API_KEY in Vercel Environment Variables.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  async function ask(question: string) {
    const clean = question.trim();
    if (!clean || isPending) return;

    setError(null);
    setInput('');
    setIsPending(true);

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: clean };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();

    try {
      const history: HistoryEntry[] = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

      const response = await fetch('/api/alex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history }),
      });

      const data = await response.json().catch(() => null);

      if (!data || data.error) {
        setError(data?.error || 'Alex is unavailable right now.');
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: 'assistant',
            content: data?.error || 'I encountered an error. Please try again or check system health.',
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: createId(), role: 'assistant', content: data.answer },
        ]);
      }
    } catch {
      setError('Connection error. Please try again.');
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', content: 'I encountered a connection error. Please try again.' },
      ]);
    } finally {
      setIsPending(false);
      scrollToBottom();
    }
  }

  function clearChat() {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: openAIStatus.status === 'ready'
          ? 'Chat cleared. How can I help you?'
          : 'OpenAI API key is missing. Add OPENAI_API_KEY in Vercel Environment Variables.',
      },
    ]);
    setError(null);
  }

  function regenerate() {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setMessages((prev) => prev.filter((m) => m.id !== lastAssistant?.id));
      void ask(lastUser.content);
    }
  }

  const statusBadge = openAIStatus.status === 'ready'
    ? { label: 'OpenAI ready', className: 'bg-green-100 text-green-800 border-green-200' }
    : { label: 'Setup required', className: 'bg-amber-100 text-amber-800 border-amber-200' };

  return (
    <div className="-mx-4 -my-6 flex min-h-screen flex-col bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1540px] flex-1 flex-col gap-6 xl:flex-row">
        {/* Left sidebar - context cards */}
        <aside className="hidden w-64 shrink-0 space-y-3 xl:block">
          <div className="rounded-2xl border border-black/7 bg-white/90 p-4 shadow-[0_20px_54px_rgba(93,107,107,0.08)]">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.13em] text-black/42">Context</p>
            <div className="space-y-2">
              {[
                { label: 'Today', href: '/dashboard', icon: Activity },
                { label: 'Providers', href: '/dashboard/settings#provider-setup-wizard', icon: RadioTower },
                { label: 'Tasks', href: '/dashboard/tasks', icon: ClipboardList },
                { label: 'Content', href: '/dashboard/content-studio', icon: PenSquare },
                { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
                { label: 'Security', href: '/dashboard/security', icon: LockKeyhole },
                { label: 'Backups', href: '/dashboard/backups', icon: DatabaseBackup },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border border-black/6 bg-[#F1F7F7]/60 px-3 py-2 text-sm font-bold text-black/66 transition hover:border-[#F7CBCA]/20 hover:text-[#F7CBCA]"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-black/7 bg-white/90 p-4 shadow-[0_20px_54px_rgba(93,107,107,0.08)]">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.13em] text-black/42">Action Links</p>
            <div className="space-y-2">
              {actionLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border border-black/6 bg-[#F1F7F7]/60 px-3 py-2 text-sm font-bold text-black/66 transition hover:border-[#F7CBCA]/20 hover:text-[#F7CBCA]"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-black/7 bg-white/90 shadow-[0_20px_54px_rgba(93,107,107,0.08)]">
          {/* Header */}
          <header className="flex flex-col gap-3 border-b border-black/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_12px_28px_rgba(202,40,81,0.22)]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-[#5D6B6B]">Alex Assistant</h1>
                <p className="text-sm leading-5 text-black/58">Personal AI assistant for your agency workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusBadge.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${openAIStatus.status === 'ready' ? 'bg-green-500' : 'bg-amber-500'}`} />
                {statusBadge.label}
              </span>
              <button
                type="button"
                onClick={clearChat}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-black/52 hover:text-[#F7CBCA]"
                aria-label="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Quick prompts */}
          <div className="border-b border-black/6 bg-[#F1F7F7]/40 px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isPending || openAIStatus.status !== 'ready'}
                  onClick={() => void ask(prompt)}
                  className="rounded-lg border border-black/8 bg-white/80 px-3 py-1.5 text-xs font-bold text-black/60 transition hover:border-[#F7CBCA]/25 hover:text-[#F7CBCA] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}

            {isPending ? (
              <div className="flex items-center gap-2 rounded-lg border border-black/7 bg-[#F1F7F7]/60 p-3 text-sm font-bold text-black/58">
                <Loader2 className="h-4 w-4 animate-spin text-[#F7CBCA]" />
                Alex is thinking...
              </div>
            ) : null}

            {error ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            {!isPending && messages.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={regenerate}
                  className="inline-flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 text-xs font-bold text-black/52 transition hover:text-[#F7CBCA]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <footer className="border-t border-black/8 bg-white/78 px-5 py-4">
            <p className="mb-2 text-xs leading-5 text-black/48">
              Do not paste API keys, tokens, passwords, or private credentials.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
              className="flex gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                disabled={isPending || openAIStatus.status !== 'ready'}
                placeholder={openAIStatus.status === 'ready' ? 'Ask Alex anything about your agency...' : 'OpenAI API key is missing'}
                className="min-h-11 flex-1 resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium leading-5 text-black shadow-sm placeholder:text-black/38 focus:border-[#F7CBCA] focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isPending || input.trim().length < 1 || openAIStatus.status !== 'ready'}
                className={buttonStyles({ size: 'icon', className: 'h-auto min-h-11' })}
                aria-label="Send message"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </footer>
        </div>
      </div>

      {/* Mobile sidebar - visible on small screens */}
      <div className="mt-4 flex flex-wrap gap-2 xl:hidden">
        {actionLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="inline-flex items-center gap-2 rounded-lg border border-black/8 bg-white/80 px-3 py-2 text-xs font-bold text-black/58 transition hover:text-[#F7CBCA]"
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';

  function copyContent() {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article
      className={`rounded-xl border p-4 ${
        isAssistant
          ? 'border-[#F7CBCA]/10 bg-white/88 text-black/70'
          : 'ms-8 border-[#F7CBCA]/18 bg-[#D5E5E5]/55 text-black/74'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-black/42">
          {isAssistant ? (
            <Bot className="h-4 w-4 text-[#F7CBCA]" />
          ) : (
            <MessageSquareText className="h-4 w-4 text-[#F7CBCA]" />
          )}
          {isAssistant ? 'Alex' : 'You'}
        </div>
        {isAssistant && (
          <button
            type="button"
            onClick={copyContent}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/6 bg-white text-black/42 hover:text-[#F7CBCA]"
            aria-label="Copy answer"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
    </article>
  );
}

export { AlexChatClient };
