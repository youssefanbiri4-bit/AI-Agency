import { z } from 'zod';
import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { withApiAuth } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { PromptCategory, PromptTargetTool } from '@/types/database';

export const dynamic = 'force-dynamic';

const CATEGORIES: PromptCategory[] = [
  'development', 'deployment', 'bug_fix', 'ui_ux', 'supabase', 'vercel', 'n8n',
  'provider_setup', 'ads_publishing', 'reports', 'documentation', 'project_planning',
  'creative_assets', 'content_studio', 'agents', 'general',
];
const TOOLS: PromptTargetTool[] = [
  'codex', 'opencode', 'kilo_code', 'n8n_ai', 'chatgpt', 'supabase_sql_editor', 'vercel_cli',
];

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  promptText: z.string().min(1).max(50000),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(CATEGORIES as [PromptCategory, ...PromptCategory[]]).default('general'),
  targetTool: z.enum(TOOLS as [PromptTargetTool, ...PromptTargetTool[]]).nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export const GET = withApiHandler(withApiAuth(['prompts:read'], async (request, context) => {
  const requestId = getRequestId(request);
  const admin = getSupabaseAdmin();
  if (!admin.client) return createApiError('SERVICE_UNAVAILABLE', { status: 503, requestId });

  const { data, error } = await admin.client
    .from('prompt_library')
    .select('id,title,description,category,target_tool,tags,usage_count,created_at,updated_at')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return createApiError('DATABASE_ERROR', { status: 500, requestId, message: error.message });
  return createApiSuccess({ prompts: data ?? [] }, { requestId });
}));

export const POST = withApiHandler(withApiAuth(['prompts:write'], async (request, context) => {
  const requestId = getRequestId(request);
  const admin = getSupabaseAdmin();
  if (!admin.client) return createApiError('SERVICE_UNAVAILABLE', { status: 503, requestId });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return createApiError('INVALID_JSON', { status: 400, requestId, message: 'Request body must be valid JSON.' });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createApiError('VALIDATION_ERROR', {
      status: 400,
      requestId,
      message: 'Invalid prompt payload.',
      meta: { issues: parsed.error.issues },
    });
  }
  const p = parsed.data;

  const { data, error } = await admin.client
    .from('prompt_library')
    .insert({
      workspace_id: context.workspaceId,
      created_by: null,
      title: p.title,
      prompt_text: p.promptText,
      description: p.description ?? null,
      category: p.category,
      target_tool: p.targetTool ?? null,
      tags: p.tags,
      metadata: {},
    })
    .select('id,title,category,created_at')
    .single();

  if (error) return createApiError('DATABASE_ERROR', { status: 500, requestId, message: error.message });
  return createApiSuccess({ prompt: data }, { status: 201, requestId, message: 'Prompt created.' });
}));
