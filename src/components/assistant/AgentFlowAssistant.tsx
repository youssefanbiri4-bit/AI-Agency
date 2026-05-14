'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/utils';
import {
  askAgentFlowAssistantAction,
  type AssistantChatHistoryMessage,
  type AssistantLink,
} from '@/app/(dashboard)/dashboard/assistant/actions';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  links?: AssistantLink[];
}

const suggestedPrompts = [
  'What should I do today?',
  'Show provider blockers',
  'Summarize System Health',
  'Find failed content items',
  'Plan an Instagram campaign',
  'Create project next actions',
  'Explain how to use the 18 agents',
  'Generate weekly content plan',
  'Prepare release summary',
  'Show recovery priorities',
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function containsArabic(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

export function AgentFlowAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi, I am AgentFlow Assistant. Ask about tasks, campaigns, providers, projects, reports, recovery, docs, or what to do next. I can guide and draft, but I will not execute publishing, task runs, GitHub writes, or scheduler actions.',
      links: [
        { label: 'Open System Health', href: '/dashboard/system-health' },
        { label: 'Open Docs', href: '/dashboard/docs' },
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestedActionCount = useMemo(
    () => messages[messages.length - 1]?.links?.length ?? 2,
    [messages]
  );

  async function ask(question: string) {
    const clean = question.trim();
    if (!clean || isPending) return;

    setError(null);
    setInput('');
    setIsPending(true);
    const recentHistory: AssistantChatHistoryMessage[] = messages
      .slice(-2)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages((current) => [
      ...current,
      { id: createId(), role: 'user', content: clean },
    ]);

    try {
      const response = await askAgentFlowAssistantAction(clean, recentHistory);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: 'assistant',
          content: response.answer,
          links: response.links,
        },
      ]);
      if (response.status !== 'answered') {
        setError(null);
      }
    } catch {
      const fallback = 'تعذر تشغيل المساعد الآن. افتح صحة النظام للتحقق من إعداد مزود الذكاء الاصطناعي وسياق مساحة العمل.';
      setError(fallback);
    } finally {
      setIsPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open AI Assistant"
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-5 end-5 z-50 inline-flex items-center gap-2 rounded-full border border-[#F7CBCA]/18 bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] px-4 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(202,40,81,0.30)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/20',
          isOpen && 'pointer-events-none opacity-0'
        )}
      >
        <Bot className="h-5 w-5" />
        AI Assistant
        <span className="ms-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-black text-[#F7CBCA]">
          {suggestedActionCount}
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <button
            type="button"
            aria-label="Close assistant overlay"
            onClick={() => setIsOpen(false)}
            className="pointer-events-auto absolute inset-0 bg-black/18 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0"
          />

          <aside className="pointer-events-auto absolute bottom-0 end-0 flex h-[min(760px,calc(100vh-24px))] w-full max-w-[460px] flex-col rounded-t-2xl border border-[#F7CBCA]/12 bg-[#F1F7F7] shadow-[0_22px_70px_rgba(93,107,107,0.22)] ring-1 ring-white/70 md:bottom-5 md:end-5 md:rounded-2xl">
            <header className="border-b border-black/8 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_12px_28px_rgba(202,40,81,0.22)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-black text-[#5D6B6B]">AgentFlow Assistant</h2>
                    <p className="mt-1 text-sm leading-5 text-black/58">
                      Ask about tasks, campaigns, providers, projects, reports, or next actions.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close assistant"
                  onClick={() => setIsOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-white text-black/62 hover:text-[#F7CBCA]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-lg border border-[#F7CBCA]/10 bg-white/82 p-3">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-black/42">
                  <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                  Suggested prompts
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isPending}
                      onClick={() => void ask(prompt)}
                      className="rounded-lg border border-black/8 bg-[#F1F7F7]/80 px-3 py-2 text-left text-xs font-bold text-black/64 hover:border-[#F7CBCA]/25 hover:text-[#F7CBCA] disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}

              {isPending ? (
                <div className="flex items-center gap-2 rounded-lg border border-black/7 bg-white/82 p-3 text-sm font-bold text-black/58">
                  <Loader2 className="h-4 w-4 animate-spin text-[#F7CBCA]" />
                  Thinking through workspace context...
                </div>
              ) : null}

              {error ? (
                <Notice tone="warning" title={containsArabic(error) ? 'تنبيه المساعد' : 'Assistant notice'}>
                  {error}
                </Notice>
              ) : null}
            </div>

            <footer className="border-t border-black/8 bg-white/78 p-4">
              <p className="mb-3 text-xs leading-5 text-black/48">
                Do not paste API keys, tokens, passwords, or private credentials.
              </p>
              <form onSubmit={submit} className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={2}
                  disabled={isPending}
                  placeholder="Ask what to fix next..."
                  className="min-h-11 flex-1 resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium leading-5 text-black shadow-sm placeholder:text-black/38 focus:border-[#F7CBCA] focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/20"
                />
                <button
                  type="submit"
                  disabled={isPending || input.trim().length < 3}
                  className={buttonStyles({ size: 'icon', className: 'h-auto min-h-11' })}
                  aria-label="Send message"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant';

  return (
    <article
      className={cn(
        'rounded-xl border p-4',
        isAssistant
          ? 'border-[#F7CBCA]/10 bg-white/88 text-black/70'
          : 'ms-8 border-[#F7CBCA]/18 bg-[#D5E5E5]/55 text-black/74'
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-black/42">
        {isAssistant ? <MessageSquareText className="h-4 w-4 text-[#F7CBCA]" /> : <CheckCircle2 className="h-4 w-4 text-[#F7CBCA]" />}
        {isAssistant ? 'Assistant' : 'You'}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      {message.links?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.links.map((link) => (
            <Link key={link.href} href={link.href} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <ExternalLink className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
