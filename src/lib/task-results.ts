import type { JsonObject, JsonValue } from '@/types';

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

const STRUCTURED_OUTPUT_KEYS = [
  'summary',
  'analysis',
  'contentPlan',
  'outreachPlan',
  'recommendations',
  'nextActions',
  'qualityNotes',
  'metadata',
];

const EMBEDDED_OUTPUT_KEYS = [
  'value',
  'output',
  'data',
  'content',
  'message',
  'text',
  'analysis',
];

const INTERNAL_RESULT_KEY_NAMES = new Set([
  'agentid',
  'callbackjson',
  'callbackpayload',
  'metadata',
  'raw',
  'rawcallback',
  'rawcallbackjson',
  'rawoutput',
  'structuredoutput',
  'taskid',
  'workspaceid',
]);

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isJsonObject(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function looksLikeJsonString(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

export function parseStringifiedJsonValue(value: JsonValue | undefined): JsonValue | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!looksLikeJsonString(trimmed)) {
      return value;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);

      if (!isJsonValue(parsed)) {
        return value;
      }

      return parseStringifiedJsonValue(parsed);
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => parseStringifiedJsonValue(item) ?? null);
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        parseStringifiedJsonValue(entryValue) ?? null,
      ])
    );
  }

  return value;
}

export function isInternalTaskResultKey(key: string) {
  return INTERNAL_RESULT_KEY_NAMES.has(key.replace(/[-_]/g, '').toLowerCase());
}

function readString(record: JsonObject, key: string) {
  const value = parseStringifiedJsonValue(record[key]);

  if (typeof value === 'string') {
    return value.trim();
  }

  if (isJsonObject(value)) {
    const nestedValue = parseStringifiedJsonValue(value[key]);
    return typeof nestedValue === 'string' ? nestedValue.trim() : '';
  }

  return '';
}

function readObject(record: JsonObject, key: string) {
  const value = parseStringifiedJsonValue(record[key]);
  return isJsonObject(value) ? value : null;
}

function readValue(record: JsonObject, key: string) {
  const value = parseStringifiedJsonValue(record[key]);
  return typeof value !== 'undefined' && hasRenderableJsonValue(value) ? value : null;
}

function formatInlineLabel(key: string) {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!label) {
    return 'Field';
  }

  return label
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function renderInlineValue(value: JsonValue | undefined): string {
  const normalized = parseStringifiedJsonValue(value);

  if (typeof normalized === 'undefined' || normalized === null) {
    return '';
  }

  if (
    typeof normalized === 'string' ||
    typeof normalized === 'number' ||
    typeof normalized === 'boolean'
  ) {
    return String(normalized).trim();
  }

  if (Array.isArray(normalized)) {
    return normalized
      .map(renderInlineValue)
      .map((item) => item.trim())
      .filter(Boolean)
      .join('; ');
  }

  return Object.entries(normalized)
    .filter(([key, entryValue]) => !isInternalTaskResultKey(key) && hasRenderableJsonValue(entryValue))
    .map(([key, entryValue]) => `${formatInlineLabel(key)}: ${renderInlineValue(entryValue)}`)
    .filter(Boolean)
    .join('; ');
}

function readStringList(record: JsonObject, key: string) {
  const value = parseStringifiedJsonValue(record[key]);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (isJsonObject(value)) {
    const nestedValue = value[key];

    if (typeof nestedValue !== 'undefined') {
      return readStringList(value, key);
    }

    const rendered = renderInlineValue(value);
    return rendered ? [rendered] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(renderInlineValue)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePriority(value: string): StructuredOutputPriority {
  const normalized = value.toLowerCase();

  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }

  return 'medium';
}

function readNextActions(record: JsonObject) {
  const value = parseStringifiedJsonValue(record.nextActions);

  if (isJsonObject(value)) {
    if (Array.isArray(value.nextActions)) {
      return readNextActions(value);
    }

    const title = readString(value, 'title');
    const description = renderInlineValue(value.description);

    if (!title && !description) {
      return [];
    }

    return [
      {
        title: title || 'Untitled action',
        description,
        priority: normalizePriority(readString(value, 'priority')),
      },
    ];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): StructuredOutputAction[] => {
    const normalizedItem = parseStringifiedJsonValue(item);

    if (!isJsonObject(normalizedItem)) {
      return [];
    }

    const title = readString(normalizedItem, 'title');
    const description = renderInlineValue(normalizedItem.description);

    if (!title && !description) {
      return [];
    }

    return [
      {
        title: title || 'Untitled action',
        description,
        priority: normalizePriority(readString(normalizedItem, 'priority')),
      },
    ];
  });
}

function readMetadata(record: JsonObject) {
  const metadata = readObject(record, 'metadata');

  if (!metadata) {
    return null;
  }

  const normalized = {
    taskId: readString(metadata, 'taskId'),
    workspaceId: readString(metadata, 'workspaceId'),
    departmentKey: readString(metadata, 'departmentKey'),
    agentName: readString(metadata, 'agentName'),
    agentId: readString(metadata, 'agentId'),
  };

  if (
    !normalized.taskId &&
    !normalized.workspaceId &&
    !normalized.departmentKey &&
    !normalized.agentName &&
    !normalized.agentId
  ) {
    return null;
  }

  return normalized;
}

function hasStructuredOutputFields(record: JsonObject) {
  return STRUCTURED_OUTPUT_KEYS.some((key) =>
    hasRenderableJsonValue(parseStringifiedJsonValue(record[key]))
  );
}

function mergeEmbeddedStructuredOutput(record: JsonObject) {
  const normalizedRecord = parseStringifiedJsonValue(record);
  const merged = isJsonObject(normalizedRecord) ? { ...normalizedRecord } : { ...record };

  for (const key of EMBEDDED_OUTPUT_KEYS) {
    const embeddedValue = parseStringifiedJsonValue(merged[key]);

    if (!isJsonObject(embeddedValue) || !hasStructuredOutputFields(embeddedValue)) {
      continue;
    }

    for (const structuredKey of STRUCTURED_OUTPUT_KEYS) {
      if (
        !hasRenderableJsonValue(merged[structuredKey]) &&
        hasRenderableJsonValue(embeddedValue[structuredKey])
      ) {
        merged[structuredKey] = embeddedValue[structuredKey];
      }
    }

    if (key === 'analysis' && hasRenderableJsonValue(embeddedValue.analysis)) {
      merged.analysis = embeddedValue.analysis;
    }
  }

  return merged;
}

function normalizeStructuredOutput(structuredOutput: JsonObject): StructuredTaskOutput | null {
  const mergedOutput = mergeEmbeddedStructuredOutput(structuredOutput);

  if (!hasStructuredOutputFields(mergedOutput)) {
    return null;
  }

  return {
    summary: readString(mergedOutput, 'summary'),
    analysis: readValue(mergedOutput, 'analysis'),
    contentPlan: readValue(mergedOutput, 'contentPlan'),
    outreachPlan: readValue(mergedOutput, 'outreachPlan'),
    recommendations: readStringList(mergedOutput, 'recommendations'),
    nextActions: readNextActions(mergedOutput),
    qualityNotes: readStringList(mergedOutput, 'qualityNotes'),
    metadata: readMetadata(mergedOutput),
  };
}

function getStructuredOutputCandidates(source: JsonObject) {
  const callbackPayload = readObject(source, 'callbackPayload');
  const callbackPayloadResult = callbackPayload ? readObject(callbackPayload, 'result') : null;
  const callbackPayloadSnakeCase = readObject(source, 'callback_payload');
  const callbackPayloadSnakeCaseResult = callbackPayloadSnakeCase
    ? readObject(callbackPayloadSnakeCase, 'result')
    : null;
  const result = readObject(source, 'result');

  return [
    callbackPayload ? readObject(callbackPayload, 'structuredOutput') : null,
    callbackPayloadResult,
    callbackPayloadSnakeCase ? readObject(callbackPayloadSnakeCase, 'structuredOutput') : null,
    callbackPayloadSnakeCaseResult,
    result ? readObject(result, 'structuredOutput') : null,
    result,
    readObject(source, 'structuredOutput'),
    source,
  ];
}

export function extractStructuredOutput(source: JsonObject | null | undefined): StructuredTaskOutput | null {
  if (!source) {
    return null;
  }

  for (const candidate of getStructuredOutputCandidates(source)) {
    if (!candidate) {
      continue;
    }

    const structuredOutput = normalizeStructuredOutput(candidate);

    if (structuredOutput) {
      return structuredOutput;
    }
  }

  return null;
}

export function hasRenderableJsonValue(value: JsonValue | undefined): boolean {
  const normalized = parseStringifiedJsonValue(value);

  if (typeof normalized === 'undefined' || normalized === null) {
    return false;
  }

  if (typeof normalized === 'string') {
    return Boolean(normalized.trim());
  }

  if (typeof normalized === 'number' || typeof normalized === 'boolean') {
    return true;
  }

  if (Array.isArray(normalized)) {
    return normalized.some(hasRenderableJsonValue);
  }

  return Object.values(normalized).some(hasRenderableJsonValue);
}
