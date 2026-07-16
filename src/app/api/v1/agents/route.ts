import { z } from 'zod';
import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { withApiAuth } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const SAFETY = ['safe', 'requires_review', 'readonly'] as const;
const EXECUTION = ['autonomous', 'supervised', 'manual', 'draft_only'] as const;
const VISIBILITY = ['workspace', 'marketplace'] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(80).default('assistant'),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().max(60).default('general'),
  icon: z.string().max(40).default('Bot'),
  accentColor: z.string().max(20).default('purple'),
  instructions: z.string().min(1).max(20000),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  safetyLevel: z.enum(SAFETY).default('requires_review'),
  executionMode: z.enum(EXECUTION).default('supervised'),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(VISIBILITY).default('workspace'),
});

export const GET = withApiHandler(withApiAuth(['agents:read'], async (request, context) => {
  const requestId = getRequestId(request);
  const admin = getSupabaseAdmin();
  if (!admin.client) return createApiError('SERVICE_UNAVAILABLE', { status: 503, requestId });

  const { data, error } = await admin.client
    .from('agent_builder_agents')
    .select('id,name,role,description,category,icon,accent_color,instructions,inputs,outputs,safety_level,execution_mode,visibility,tags,usage_count,created_at,updated_at')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return createApiError('DATABASE_ERROR', { status: 500, requestId, message: error.message });
  return createApiSuccess({ agents: data ?? [] }, { requestId });
}));

export const POST = withApiHandler(withApiAuth(['agents:write'], async (request, context) => {
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
      message: 'Invalid agent payload.',
      meta: { issues: parsed.error.issues },
    });
  }
  const p = parsed.data;

  const { data, error } = await admin.client
    .from('agent_builder_agents')
    .insert({
      workspace_id: context.workspaceId,
      created_by: null,
      name: p.name,
      role: p.role,
      description: p.description ?? null,
      category: p.category,
      icon: p.icon,
      accent_color: p.accentColor,
      instructions: p.instructions,
      inputs: p.inputs,
      outputs: p.outputs,
      safety_level: p.safetyLevel,
      execution_mode: p.executionMode,
      tags: p.tags,
      visibility: p.visibility,
      is_template: false,
      metadata: {},
    })
    .select('id,name,role,visibility,created_at')
    .single();

  if (error) return createApiError('DATABASE_ERROR', { status: 500, requestId, message: error.message });
  return createApiSuccess({ agent: data }, { status: 201, requestId, message: 'Agent created.' });
}));
