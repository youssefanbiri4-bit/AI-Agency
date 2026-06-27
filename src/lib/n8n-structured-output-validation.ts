import { z } from 'zod';
import type { JsonObject, JsonValue } from '@/types';
import { increment } from '@/lib/monitoring/metrics';

export const N8N_STRUCTURED_OUTPUT_SCHEMA_VERSION = '1' as const;

export type StructuredOutputPriority = 'high' | 'medium' | 'low';

export interface StructuredOutputAction {
  title: string;
  description: string;
  priority: StructuredOutputPriority;
}

export interface StructuredOutputMetadata {
  taskId: string;
  workspaceId: string;
  departmentKey: string;
  agentName: string;
  agentId: string;
}

export interface StructuredTaskOutput {
  summary: string;
  analysis: JsonValue | null;
  contentPlan: JsonValue | null;
  outreachPlan: JsonValue | null;
  recommendations: string[];
  nextActions: StructuredOutputAction[];
  qualityNotes: string[];
  metadata: StructuredOutputMetadata | null;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function schemaJsonValue(): z.ZodTypeAny {
  // Compatibility mode: be permissive for arbitrary agent payloads.
  // We validate *presence* and key types at the structuredOutput boundary,
  // but avoid overly strict recursive JSON typing to prevent zod signature issues.
  return z.any();
}

/**
 * Additive: accept JSON value or stringified JSON.
 * We keep this permissive because n8n has historically produced either.
 */
function schemaMaybeStringifiedJsonValue(): z.ZodType<JsonValue | undefined> {
  return z
    .union([schemaJsonValue(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val !== 'string') return val as unknown as JsonValue;

      const trimmed = val.trim();
      if (!trimmed) return undefined;

      if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        // Keep historical behavior: some agents put plain text here.
        return val as unknown as JsonValue;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return parsed as unknown as JsonValue;
      } catch {
        return val as unknown as JsonValue;
      }
    }) as unknown as z.ZodType<JsonValue | undefined>;
}

const summarySchema = z
  .union([z.string(), z.undefined(), z.null()])
  .optional()
  .transform((v) => (typeof v === 'string' ? v.trim() : ''));

const prioritySchema: z.ZodType<StructuredOutputPriority> = z
  .string()
  .transform((s) => s.toLowerCase())
  .refine((s): s is StructuredOutputPriority => s === 'high' || s === 'medium' || s === 'low', {
    message: 'priority must be one of: high|medium|low',
  })
  .catch('medium');

const actionSchema = z.object({
  title: z.string().optional().transform((v) => (v ? v.trim() : '')).catch(''),
  description: z
    .union([z.string(), z.undefined(), z.null()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v : ''))
    .catch(''),
  priority: prioritySchema.optional().catch('medium'),
});

export const recommendationsSchema = z
  .union([z.array(z.string()), z.string(), z.undefined(), z.null()])
  .optional()
  .transform((val): string[] => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(val)) {
      return val.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    }
    return [];
  });

export const qualityNotesSchema = z
  .union([z.array(z.string()), z.string(), z.undefined(), z.null()])
  .optional()
  .transform((val): string[] => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(val)) {
      return val.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    }
    return [];
  });

export const metadataSchema = z
  .union([z.object({}).passthrough(), z.undefined(), z.null()])
  .optional()
  .transform((val): StructuredOutputMetadata | null => {
    if (!isJsonObject(val)) return null;

    // Additive: we only require at least one identifier; otherwise treat as null.
    const taskId = typeof val.taskId === 'string' ? val.taskId.trim() : '';
    const workspaceId = typeof val.workspaceId === 'string' ? val.workspaceId.trim() : '';
    const departmentKey = typeof val.departmentKey === 'string' ? val.departmentKey.trim() : '';
    const agentName = typeof val.agentName === 'string' ? val.agentName.trim() : '';
    const agentId = typeof val.agentId === 'string' ? val.agentId.trim() : '';

    if (!taskId && !workspaceId && !departmentKey && !agentName && !agentId) {
      return null;
    }

    return {
      taskId,
      workspaceId,
      departmentKey,
      agentName,
      agentId,
    };
  });

export const structuredOutputSchema = z
  .object({
    // Additive / safe compatibility mode:
    // - summary: we coerce missing -> ''
    // - analysis/contentPlan/outreachPlan: accept JSON primitives/objects/arrays or null/missing
    // - recommendations/qualityNotes: coerce into string[]
    // - nextActions: accept either array or single object-like item
    // - metadata: coerce into StructuredOutputMetadata|null
    summary: summarySchema.optional(),
    analysis: schemaMaybeStringifiedJsonValue().optional().nullable().transform((v) => v ?? null),
    contentPlan: schemaMaybeStringifiedJsonValue().optional().nullable().transform((v) => v ?? null),
    outreachPlan: schemaMaybeStringifiedJsonValue().optional().nullable().transform((v) => v ?? null),
    recommendations: recommendationsSchema.optional(),
    nextActions: z
      .union([z.array(actionSchema), actionSchema, z.undefined(), z.null()])
      .optional()
      .transform((val): StructuredOutputAction[] => {
        if (!val) return [];
        if (Array.isArray(val)) {
          return val
            .map((a) => ({
              title: a.title || 'Untitled action',
              description: a.description || '',
              priority: a.priority || 'medium',
            }))
            .filter((a) => a.title || a.description);
        }
        return [
          {
            title: val.title || 'Untitled action',
            description: val.description || '',
            priority: val.priority || 'medium',
          },
        ];
      }),
    qualityNotes: qualityNotesSchema.optional(),
    metadata: metadataSchema.optional().nullable(),
  })
  // additive: allow extra keys, since we may persist raw debug keys
  .passthrough();

export type ValidationErrorCode =
  | 'NO_STRUCTURED_OUTPUT'
  | 'STRUCTURED_OUTPUT_SCHEMA_INVALID'
  | 'UNEXPECTED_RESULT_SHAPE';

export interface StructuredOutputValidationError {
  code: ValidationErrorCode;
  message: string;
  zodError?: unknown;
  path?: string[];
  schemaVersion: typeof N8N_STRUCTURED_OUTPUT_SCHEMA_VERSION;
}

export interface StructuredOutputValidationResult {
  ok: boolean;
  schemaVersion: typeof N8N_STRUCTURED_OUTPUT_SCHEMA_VERSION;
  extracted?: StructuredTaskOutput;
  error?: StructuredOutputValidationError;
}

function findStructuredOutputCandidates(result: unknown): unknown[] {
  if (!result) return [];
  if (!isJsonObject(result)) return [];

  const obj = result as Record<string, unknown>;

  const candidates: unknown[] = [];

  // Mirror the existing extraction heuristics in src/lib/task-results.ts
  const callbackPayload = isJsonObject(obj.callbackPayload)
    ? (obj.callbackPayload as Record<string, unknown>)
    : null;

  let callbackPayloadStructured: unknown = null;
  if (callbackPayload && isJsonObject(callbackPayload.result)) {
    callbackPayloadStructured = (callbackPayload.result as Record<string, unknown>).structuredOutput;
  }

  const callbackPayloadSnake = isJsonObject(obj.callback_payload)
    ? (obj.callback_payload as Record<string, unknown>)
    : null;

  let callbackPayloadSnakeStructured: unknown = null;
  if (callbackPayloadSnake && isJsonObject(callbackPayloadSnake.result)) {
    callbackPayloadSnakeStructured = (callbackPayloadSnake.result as Record<string, unknown>).structuredOutput;
  }

  const directResult = isJsonObject(obj.result) ? (obj.result as Record<string, unknown>) : null;

  let directResultStructured: unknown = null;
  if (directResult && isJsonObject(directResult)) {
    directResultStructured = (directResult as Record<string, unknown>).structuredOutput ?? null;
  }

  candidates.push(
    callbackPayload ? (callbackPayload as Record<string, unknown>).structuredOutput : null,
    callbackPayloadStructured,
    callbackPayloadSnake ? (callbackPayloadSnake as Record<string, unknown>).structuredOutput : null,
    callbackPayloadSnakeStructured,
    directResultStructured,
    obj.structuredOutput
  );

  return candidates.filter((c) => c && isJsonObject(c));
}

export function validateStructuredOutputFromCallbackResult(rawResult: unknown): StructuredOutputValidationResult {
  const schemaVersion = N8N_STRUCTURED_OUTPUT_SCHEMA_VERSION;

  try {
    const candidates = findStructuredOutputCandidates(rawResult);

    if (candidates.length === 0) {
      return {
        ok: false,
        schemaVersion,
        error: {
          code: 'NO_STRUCTURED_OUTPUT',
          message: 'No structuredOutput candidate found in callback result.',
          schemaVersion,
          path: ['structuredOutput'],
        },
      };
    }

    // Validate the first candidate that parses successfully.
    for (const candidate of candidates) {
      const parsed = structuredOutputSchema.safeParse(candidate);

      if (!parsed.success) {
        continue;
      }

      // Extract parsed data in a normalized shape.
      const data = parsed.data as unknown as {
        summary?: string;
        analysis?: JsonValue | null;
        contentPlan?: JsonValue | null;
        outreachPlan?: JsonValue | null;
        recommendations?: string[];
        nextActions?: StructuredOutputAction[];
        qualityNotes?: string[];
        metadata?: StructuredOutputMetadata | null;
      };

      const extracted: StructuredTaskOutput = {
        summary: typeof data.summary === 'string' ? data.summary : '',
        analysis: data.analysis ?? null,
        contentPlan: data.contentPlan ?? null,
        outreachPlan: data.outreachPlan ?? null,
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        nextActions: Array.isArray(data.nextActions) ? data.nextActions : [],
        qualityNotes: Array.isArray(data.qualityNotes) ? data.qualityNotes : [],
        metadata: data.metadata ?? null,
      };

      return { ok: true, schemaVersion, extracted };
    }

    // If all candidates exist but none validates, return detailed error from first attempt.
    const firstCandidate = candidates[0];
    const firstParse = structuredOutputSchema.safeParse(firstCandidate);

    return {
      ok: false,
      schemaVersion,
      error: {
        code: 'STRUCTURED_OUTPUT_SCHEMA_INVALID',
        message: 'Structured output exists but failed schema validation.',
        schemaVersion,
        zodError: firstParse.success ? undefined : firstParse.error,
        path: ['structuredOutput'],
      },
    };
  } catch {
    increment('callback_structured_output_validation_malformed_total', { error: 'unexpected_exception' });
    return {
      ok: false,
      schemaVersion,
      error: {
        code: 'UNEXPECTED_RESULT_SHAPE',
        message: 'Unexpected callback result shape during validation.',
        schemaVersion,
      },
    };
  }
}

export function classifyStructuredOutputValidationError(result: StructuredOutputValidationResult) {
  if (result.ok) return { validationCategory: 'ok' as const, errorCode: null as string | null };

  const errorCode = result.error?.code ?? 'unknown';
  return {
    validationCategory: errorCode === 'NO_STRUCTURED_OUTPUT' ? ('missing_structured_output' as const) : ('invalid_structured_output' as const),
    errorCode,
  };
}
