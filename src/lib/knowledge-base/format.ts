import type { KnowledgeSearchResult } from './types';

export function sanitizeKnowledgeText(value: unknown, limit = 1200) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key|token|password|authorization|webhook_secret)\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[redacted]')
    .replace(/("(?:access_token|refresh_token|client_secret|api_key|token|password|authorization|webhook_secret)"\s*:\s*)"[^"]+"/gi, '$1"[redacted]"')
    .replace(/https:\/\/[^\s"'<>]*(webhook|callback|token|secret|key)[^\s"'<>]*/gi, '[redacted-url]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

export function compactKnowledgeText(values: Array<unknown>, limit = 1600) {
  return values
    .map((value) => sanitizeKnowledgeText(value, limit))
    .filter(Boolean)
    .join('\n')
    .slice(0, limit);
}

export function formatKnowledgeResultMarkdown(result: KnowledgeSearchResult) {
  return [
    '# Knowledge Result',
    '',
    '## Source',
    `${result.source_type}${result.href ? ` - ${result.href}` : ''}`,
    '',
    '## Summary',
    result.summary || result.title,
    '',
    '## Key Details',
    result.highlights.length ? result.highlights.map((item) => `- ${item}`).join('\n') : sanitizeKnowledgeText(result.content, 700),
    '',
    '## Safe Next Action',
    result.href ? `Open the source in AgentFlow AI for manual review: ${result.href}` : 'Review the source record inside AgentFlow AI before using it.',
  ].join('\n').trim() + '\n';
}

export function formatKnowledgeSummaryMarkdown(results: KnowledgeSearchResult[], query: string) {
  return [
    '# Knowledge Summary',
    '',
    `Query: ${sanitizeKnowledgeText(query, 240) || 'Recent safe knowledge'}`,
    '',
    ...results.map((result, index) => [
      `## ${index + 1}. ${result.title}`,
      `Source: ${result.source_type}`,
      `Score: ${result.score}`,
      result.summary,
      result.href ? `Open: ${result.href}` : null,
    ].filter(Boolean).join('\n')),
  ].join('\n\n').trim() + '\n';
}

export function formatKnowledgeResultsForAlex(results: KnowledgeSearchResult[]) {
  if (results.length === 0) return 'No relevant knowledge base results found.';

  return results.slice(0, 6).map((result, index) => [
    `[${index + 1}] Source: ${result.source_type}`,
    `Title: ${sanitizeKnowledgeText(result.title, 140)}`,
    `Summary: ${sanitizeKnowledgeText(result.summary || result.content, 360)}`,
    result.href ? `Open: ${result.href}` : null,
  ].filter(Boolean).join('\n')).join('\n\n');
}
