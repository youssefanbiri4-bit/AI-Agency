import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAlexWorkspaceContext } from '@/lib/alex/alex-context';
import { ALEX_SYSTEM_PROMPT, ALEX_CONTEXT_INSTRUCTION, ALEX_TEMPLATE_INSTRUCTION } from '@/lib/alex/alex-system-prompt';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkSlidingWindowRateLimit, buildUserRateLimitKey, RATE_LIMIT_ACTIONS } from '@/lib/sliding-window-rate-limit';
import { checkPayloadSize, PAYLOAD_LIMITS } from '@/lib/payload-limit';
import { getRequestId, nowISO } from '@/lib/api-response';
import {
  formatRecommendationContextForAlex,
  recommendAgentTemplates,
} from '@/lib/agent-library/recommendations';
import { searchKnowledgeBase } from '@/lib/knowledge-base/search';
import { formatKnowledgeResultsForAlex } from '@/lib/knowledge-base/format';
import { getTemplateUsageSummaryAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';
import {
  formatToolResultsForAlex,
  getBlockedToolIds,
  runAlexTools,
} from '@/lib/alex-tools/registry';
import type { AlexToolContext } from '@/lib/alex-tools/types';
import { formatIndustryPackRecommendationsForAlex } from '@/lib/industry-packs/packs';
import { setupBlockerMessage } from '@/lib/safe-messages';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const ALEX_CHAT_RATE_LIMIT = 20;
const ALEX_CHAT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// Zod schema for Alex chat request body
const alexChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message is too long'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(10)
    .optional()
    .default([]),
  selectedTemplateId: z.string().max(120).optional().nullable(),
});

function jsonError(error: string, category: string, status: number, requestId?: string) {
  return NextResponse.json({ error, category, requestId: requestId ?? null, timestamp: nowISO() }, { status });
}

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

function isKnowledgeIntent(message: string) {
  return /knowledge base|search my|find my|what prompts|prompt library|playbook|blueprint|workflow review|quality review|automation blueprints|AI Studio|saved about|لخص ليا|شنو عندي|شنو آخر|شنو المشاكل|شنو status|فين|بحث|قاعدة المعرفة|prompts do i have|summarize my workflow/i.test(message);
}

function isDangerousActionIntent(message: string) {
  return /run n8n|شغل n8n|execute n8n|publish|نشر|schedule|جدول|create live ad|live ad|spend|صرف|delete|مسح|send email|email.*send|contact client|github commit|github push|pull request|open pr|change provider|provider settings/i.test(message);
}

function selectBlockedTools(message: string) {
  const tools: string[] = [];
  const lower = message.toLowerCase();

  if (/run n8n|execute n8n|شغل n8n/.test(lower)) tools.push('run_n8n_workflow');
  if (/publish|نشر/.test(lower)) tools.push('publish_content');
  if (/schedule|جدول/.test(lower)) tools.push('schedule_content');
  if (/live ad|create.*ad|إعلان/.test(lower)) tools.push('create_live_ad');
  if (/spend|صرف|money/.test(lower)) tools.push('spend_money');
  if (/delete|مسح|حذف/.test(lower)) tools.push('delete_data');
  if (/send email|email.*send|راسل|contact client/.test(lower)) tools.push('send_email');
  if (/commit/.test(lower)) tools.push('github_commit');
  if (/push/.test(lower)) tools.push('github_push');
  if (/pull request|open pr/.test(lower)) tools.push('open_pull_request');
  if (/change provider|provider settings/.test(lower)) tools.push('change_provider_settings');

  return tools.filter((tool) => getBlockedToolIds().includes(tool));
}

function selectReadTools(message: string) {
  const tools = new Set<string>();

  if (/today|شنو خاصني|daily|priorit|لخص ليا tasks|tasks?|مهام|مهمة/i.test(message)) {
    tools.add('get_task_summary');
    tools.add('get_recent_tasks');
  }
  if (/provider|system health|blocker|google ads|openai|vercel|supabase|صحة|blockers|status/i.test(message)) {
    tools.add('get_provider_health_summary');
  }
  if (/prompt library|prompts?|تعليمات|prompt/i.test(message)) tools.add('get_prompt_library_summary');
  if (/agent library|agents?|وكلاء|agent/i.test(message)) tools.add('get_agent_library_summary');
  if (/content studio|content|محتوى|caption|ad copy/i.test(message)) tools.add('get_content_studio_summary');
  if (/ai studio|creative|asset|image|video|صورة|فيديو/i.test(message)) tools.add('get_ai_studio_summary');
  if (/playbook|workflow|سير العمل|campaign workflow/i.test(message)) tools.add('get_workflow_playbooks_summary');
  if (/automation blueprint|blueprint|automation|أتمتة/i.test(message)) tools.add('get_automation_blueprints_summary');
  if (/quality review|review quality|راجع|مراجعة الجودة/i.test(message)) tools.add('get_quality_review_summary');
  if (/report|rapport|تقرير|summary|لخص/i.test(message)) tools.add('get_reports_summary');
  if (/knowledge base|search|find|قلب|بحث|شنو عندي|saved about/i.test(message)) tools.add('search_knowledge_base');

  if (tools.size === 0 && /شنو|what|summarize|لخص|status/i.test(message)) {
    tools.add('get_task_summary');
    tools.add('get_provider_health_summary');
  }

  return Array.from(tools);
}

function selectDraftTools(message: string) {
  if (isDangerousActionIntent(message)) return [];
  if (/task|مهمة|وجد ليا task|create task|prepare task/i.test(message)) return ['prepare_task_draft'];
  if (/content draft|content studio|caption|محتوى/i.test(message)) return ['prepare_content_studio_draft'];
  if (/n8n|blueprint/i.test(message)) return ['prepare_n8n_blueprint_draft'];
  if (/workflow plan|playbook|workflow|سير العمل/i.test(message)) return ['prepare_workflow_plan_draft'];
  if (/quality review|راجع/i.test(message)) return ['prepare_quality_review_draft'];
  if (/follow up|متابعة|رسالة للعميل|email|whatsapp/i.test(message)) return ['prepare_follow_up_message_draft'];
  return [];
}

async function getToolContext(): Promise<AlexToolContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) return null;

  return {
    supabase,
    userId: user.id,
    workspaceId: workspaceResult.data.id,
    workspaceName: workspaceResult.data.name,
  };
}

async function getKnowledgeContextForAlex(message: string) {
  if (!isKnowledgeIntent(message)) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 'Knowledge Base: user is not signed in.';

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) return 'Knowledge Base: no active workspace found.';

  const results = await searchKnowledgeBase(message, { maxResults: 6 }, workspaceResult.data.id, user.id);
  if (results.error) return `Knowledge Base error: ${results.error}`;
  if (results.data.length === 0) return 'Knowledge Base: no relevant safe entries found.';

  return [
    'Safe Knowledge Base context. Use only these retrieved snippets for knowledge-base claims. Cite source labels in the answer.',
    formatKnowledgeResultsForAlex(results.data),
  ].join('\n\n');
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    if (!isAlexEnabled()) {
      return NextResponse.json({ error: 'Alex Assistant is disabled.', category: 'disabled', requestId, timestamp: nowISO() }, { status: 503 });
    }

    // Payload size check
    const sizeCheck = await checkPayloadSize(request, PAYLOAD_LIMITS.alexChat);
    if (!sizeCheck.ok) {
      const res = sizeCheck.response as NextResponse;
      return NextResponse.json({ 
        error: 'Payload too large', 
        category: 'bad_request', 
        requestId, 
        timestamp: nowISO() 
      }, { status: 413, headers: Object.fromEntries(res.headers.entries()) });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError(
        'خاصك تسجل الدخول باش تستعمل Alex. Authentication is required.',
        'unauthorized',
        401,
        requestId
      );
    }

    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

    if (workspaceResult.error) {
      return jsonError(
        'تعذر التحقق من مساحة العمل. Workspace access could not be verified.',
        'workspace_error',
        403,
        requestId
      );
    }

    if (!workspaceResult.data) {
      return jsonError(
        'ما عندكش مساحة عمل مفعلة أو صلاحية للوصول. Active workspace access is required.',
        'workspace_required',
        403,
        requestId
      );
    }

    const membershipResult = await getCurrentWorkspaceMembership(
      supabase,
      workspaceResult.data.id,
      user.id
    );

    if (membershipResult.error) {
      return jsonError(
        'تعذر التحقق من صلاحيات مساحة العمل. Workspace access could not be verified.',
        'workspace_error',
        403,
        requestId
      );
    }

    const hasWorkspaceAccess = Boolean(membershipResult.data) || workspaceResult.data.owner_id === user.id;

    if (!hasWorkspaceAccess) {
      return jsonError(
        'ما عندكش صلاحية للوصول لهذه المساحة. Workspace access is required.',
        'workspace_forbidden',
        403,
        requestId
      );
    }

    // Fixed-window rate limit (existing)
    const limiter = await checkRateLimit({
      key: `alex-chat:${user.id}`,
      limit: ALEX_CHAT_RATE_LIMIT,
      windowMs: ALEX_CHAT_RATE_LIMIT_WINDOW_MS,
    });

    if (!limiter.allowed) {
      return jsonError(
        'وصلتي للحد المؤقت لرسائل Alex. عاود المحاولة بعد شوية.',
        'rate_limited',
        429,
        requestId
      );
    }

    // Sliding window rate limit for Alex chat (more accurate per-minute rate limiting)
    const slidingLimiter = await checkSlidingWindowRateLimit({
      key: buildUserRateLimitKey(user.id, RATE_LIMIT_ACTIONS.AI_CHAT),
      limit: 15,
      windowMs: 60_000, // 15 messages per minute
    });

    if (!slidingLimiter.allowed) {
      return NextResponse.json({
        error: 'Alex chat rate limit reached. Please wait a moment before sending another message.',
        category: 'rate_limited',
        requestId,
        timestamp: nowISO(),
        retryAfterMs: slidingLimiter.resetInMs,
      }, {
        status: 429,
        headers: {
          'X-Request-ID': requestId,
          'Retry-After': String(Math.ceil(slidingLimiter.resetInMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      });
    }

    const apiKey = getOpenAIKey();
    if (!apiKey) {
      return NextResponse.json({
        error: setupBlockerMessage({
          missing: 'OPENAI_API_KEY',
          reason: 'Alex can only call OpenAI from the server after the key is configured',
          next: 'add OPENAI_API_KEY in Vercel server environment variables, redeploy, and retry Alex',
        }),
        category: 'missing_key',
        requestId,
        timestamp: nowISO(),
      }, { status: 200 });
    }

    // Zod validation for the request body
    const body = await request.json().catch(() => null);
    const validation = alexChatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Message is required.', 
        category: 'bad_request',
        requestId,
        timestamp: nowISO(),
      }, { status: 400 });
    }

    const { message: userMessage, history, selectedTemplateId } = validation.data;

    const context = await getAlexWorkspaceContext();
    const knowledgeContext = await getKnowledgeContextForAlex(userMessage);
    const toolContext = await getToolContext();
    const selectedToolIds = [
      ...selectBlockedTools(userMessage),
      ...selectReadTools(userMessage),
      ...selectDraftTools(userMessage),
    ];
    const toolSummary = toolContext
      ? await runAlexTools(selectedToolIds, { message: userMessage, query: userMessage }, toolContext)
      : { toolsUsed: [], draftAction: null, blockedMessages: ['Alex tools were not used because no active signed-in workspace was available.'] };
    const model = getOpenAIModel();
    const usageResult = await getTemplateUsageSummaryAction();
    const recommendations = recommendAgentTemplates({
      userMessage,
      selectedTemplateId: selectedTemplateId ?? null,
      usageSummary: usageResult.data,
      maxResults: 5,
    });
    const templateBlock = formatRecommendationContextForAlex(recommendations);
    const industryPackBlock = formatIndustryPackRecommendationsForAlex(userMessage);

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
      { role: 'system', content: `${ALEX_TEMPLATE_INSTRUCTION}\n\nSafe AgentFlow template context:\n${templateBlock}` },
      ...(industryPackBlock
        ? [{
            role: 'system',
            content: [
              'Safe Industry Pack recommendations are available. Recommend packs only as planning-only, draft-only starters.',
              'When recommending a pack, include pack name, why it fits, recommended workflow, suggested agents, and one safe next action.',
              industryPackBlock,
            ].join('\n\n'),
          }]
        : []),
      ...(toolSummary.toolsUsed.length > 0
        ? [{
            role: 'system',
            content: [
              'Alex used safe internal tools server-side. Use the compact tool results below as workspace context.',
              'Read-only tools can summarize data only. Draft-only tools prepare drafts only.',
              'Blocked tools mean the requested action must not be executed by Alex.',
              'Never claim that n8n ran, content was published/scheduled, money was spent, emails were sent, data was deleted, GitHub writes happened, or provider settings changed.',
              'If a draft action is present, ask the user to review it and confirm before any pending task is created.',
              formatToolResultsForAlex(toolSummary.toolsUsed),
            ].join('\n\n'),
          }]
        : []),
      ...(knowledgeContext
        ? [{
            role: 'system',
            content: [
              knowledgeContext,
              'If the Knowledge Base context says no relevant entries were found, say that clearly.',
              'Never send or reveal secrets, raw logs, env values, provider credentials, tokens, webhook secrets, or private provider responses.',
              'Never claim that publishing, scheduling, spending, n8n execution, deletion, or external actions happened.',
            ].join('\n'),
          }]
        : []),
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
        return NextResponse.json({ error: setupBlockerMessage({
          missing: 'valid OpenAI server key',
          reason: 'OpenAI rejected the configured server credential',
          next: 'rotate or correct OPENAI_API_KEY in Vercel, then redeploy',
        }), category: 'invalid_key', requestId, timestamp: nowISO() }, { status: 200 });
      }
      if (statusCode === 429 || code === 'insufficient_quota' || message.includes('quota')) {
        return NextResponse.json({ error: setupBlockerMessage({
          missing: 'OpenAI quota or billing capacity',
          reason: 'OpenAI rate/quota limits prevent a safe response',
          next: 'review OpenAI billing/quota and try again after capacity is restored',
        }), category: 'quota_required', requestId, timestamp: nowISO() }, { status: 200 });
      }
      if (statusCode === 404 || code === 'model_not_found' || message.includes('model')) {
        return NextResponse.json({ error: setupBlockerMessage({
          missing: 'available OpenAI model access',
          reason: 'the configured model is not available to this OpenAI account',
          next: 'set OPENAI_MODEL to an available model or enable access in OpenAI',
        }), category: 'model_not_found', requestId, timestamp: nowISO() }, { status: 200 });
      }
      if (statusCode === 429) {
        return NextResponse.json({ error: 'OpenAI is temporarily rate limited. Blocked because the provider asked us to slow down. Next: wait a moment and retry. / OpenAI محدود مؤقتاً، انتظر قليلاً ثم أعد المحاولة.', category: 'rate_limited', requestId, timestamp: nowISO() }, { status: 200 });
      }
      return NextResponse.json({ error: setupBlockerMessage({
        missing: 'healthy OpenAI provider response',
        reason: 'OpenAI did not return a usable response',
        next: 'check OpenAI key, model access, quota, billing, and provider status, then retry',
      }), category: 'provider_error', requestId, timestamp: nowISO() }, { status: 200 });
    }

    const content = payload?.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
      return NextResponse.json({ error: 'OpenAI returned an empty response.', category: 'empty_response', requestId, timestamp: nowISO() }, { status: 200 });
    }

    return NextResponse.json({
      answer: content,
      category: 'answered',
      requestId,
      timestamp: nowISO(),
      toolsUsed: toolSummary.toolsUsed.map((tool) => ({
        toolId: tool.toolId,
        toolName: tool.toolName,
        sourceLabel: tool.sourceLabel,
        riskLevel: tool.riskLevel,
        summary: tool.summary,
        blocked: Boolean(tool.blocked),
      })),
      draftAction: toolSummary.draftAction,
      blockedMessages: toolSummary.blockedMessages,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('timeout'));
    if (isTimeout) {
      return NextResponse.json({ error: 'Request timed out. Please try again.', category: 'timeout', requestId, timestamp: nowISO() }, { status: 200 });
    }
    return NextResponse.json({ error: setupBlockerMessage({
      missing: 'healthy OpenAI provider response',
      reason: 'Alex could not complete the server-side OpenAI request safely',
      next: 'check OpenAI key, model access, quota, billing, and provider status, then retry',
    }), category: 'provider_error', requestId, timestamp: nowISO() }, { status: 200 });
  }
}
