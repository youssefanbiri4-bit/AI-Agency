import { NextResponse } from 'next/server';
import { getAlexWorkspaceContext } from '@/lib/alex/alex-context';
import { ALEX_SYSTEM_PROMPT, ALEX_CONTEXT_INSTRUCTION } from '@/lib/alex/alex-system-prompt';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5.5';
}

function isAlexEnabled(): boolean {
  return process.env.ALEX_ASSISTANT_ENABLED !== 'false';
}

function trimText(value: string, limit = 300) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= limit) return cleaned;
  return cleaned.slice(0, Math.max(0, limit - 1)).trim() + '…';
}

export async function POST(request: Request) {
  try {
    if (!isAlexEnabled()) {
      return NextResponse.json({ error: 'Alex Assistant is disabled.', category: 'disabled' }, { status: 503 });
    }

    const apiKey = getOpenAIKey();
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key is missing. Add OPENAI_API_KEY in Vercel Environment Variables.',
        category: 'missing_key',
      }, { status: 200 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== 'string' || body.message.trim().length < 1) {
      return NextResponse.json({ error: 'Message is required.', category: 'bad_request' }, { status: 400 });
    }

    const userMessage = body.message.trim().slice(0, 4000);
    const history = Array.isArray(body.history) ? body.history.slice(-4) : [];

    const context = await getAlexWorkspaceContext();
    const model = getOpenAIModel();

    const contextBlock = [
      `Workspace: ${context.workspaceName}`,
      `Tasks: ${context.tasksSummary}`,
      `Tasks needing review: ${context.tasksNeedingReview}`,
      `Content: ${context.contentSummary}`,
      `Projects: ${context.projectsSummary}`,
      `Security: ${context.securitySummary}`,
      `Backups: ${context.backupSummary}`,
      `Releases: ${context.latestReleases}`,
      context.dataNotice ? `Data notice: ${context.dataNotice}` : null,
    ].filter(Boolean).join('\n');

    const messages = [
      { role: 'system', content: ALEX_SYSTEM_PROMPT },
      { role: 'system', content: `${ALEX_CONTEXT_INSTRUCTION}\n\nSafe workspace context:\n${contextBlock}` },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: trimText(m.content, 2000),
      })),
      { role: 'user', content: userMessage },
    ];

    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const statusCode = response.status;
      const errorBody = payload?.error;
      const code = errorBody?.code ?? '';
      const message = errorBody?.message ?? '';

      if (statusCode === 401) {
        return NextResponse.json({ error: 'Invalid OpenAI API key. Check OPENAI_API_KEY.', category: 'invalid_key' }, { status: 200 });
      }
      if (statusCode === 429 || code === 'insufficient_quota' || message.includes('quota')) {
        return NextResponse.json({ error: 'OpenAI quota exceeded. Check billing and usage limits.', category: 'quota_required' }, { status: 200 });
      }
      if (statusCode === 404 || code === 'model_not_found' || message.includes('model')) {
        return NextResponse.json({ error: `Model "${model}" not found. Check OPENAI_MODEL or your OpenAI account access.`, category: 'model_not_found' }, { status: 200 });
      }
      if (statusCode === 429) {
        return NextResponse.json({ error: 'Rate limited by OpenAI. Please wait and try again.', category: 'rate_limited' }, { status: 200 });
      }
      return NextResponse.json({ error: 'OpenAI provider failed. Check OPENAI_API_KEY, model access, quota, or billing.', category: 'provider_error' }, { status: 200 });
    }

    const content = payload?.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
      return NextResponse.json({ error: 'OpenAI returned an empty response.', category: 'empty_response' }, { status: 200 });
    }

    return NextResponse.json({ answer: content, category: 'answered' });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('timeout'));
    if (isTimeout) {
      return NextResponse.json({ error: 'Request timed out. Please try again.', category: 'timeout' }, { status: 200 });
    }
    return NextResponse.json({ error: 'OpenAI provider failed. Check OPENAI_API_KEY, model access, quota, or billing.', category: 'provider_error' }, { status: 200 });
  }
}
