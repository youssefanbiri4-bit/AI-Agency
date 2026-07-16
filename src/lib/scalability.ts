/**
 * Scalability Patterns
 *
 * Common utilities and patterns for building scalable features.
 * Includes pagination, filtering, sorting, and data transformation helpers.
 */

// ─── Pagination ─────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginate<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const { page, pageSize } = params;
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: items.slice(start, end),
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ─── Sorting ────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortParams<T> {
  key: keyof T;
  direction: SortDirection;
}

export function sortBy<T>(items: T[], sort: SortParams<T>): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[sort.key];
    const bVal = b[sort.key];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

// ─── Filtering ──────────────────────────────────────────────────────

export interface FilterParams<T> {
  /** Field to filter on */
  field: keyof T;
  /** Filter operator */
  operator: 'eq' | 'neq' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
  /** Value to filter by */
  value: unknown;
}

export function filterBy<T>(items: T[], filters: FilterParams<T>[]): T[] {
  return items.filter((item) =>
    filters.every((filter) => {
      const fieldValue = item[filter.field];
      const filterValue = filter.value;

      switch (filter.operator) {
        case 'eq':
          return fieldValue === filterValue;
        case 'neq':
          return fieldValue !== filterValue;
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
        case 'startsWith':
          return String(fieldValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
        case 'endsWith':
          return String(fieldValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
        case 'gt':
          return (fieldValue as number) > (filterValue as number);
        case 'lt':
          return (fieldValue as number) < (filterValue as number);
        case 'gte':
          return (fieldValue as number) >= (filterValue as number);
        case 'lte':
          return (fieldValue as number) <= (filterValue as number);
        default:
          return true;
      }
    })
  );
}

// ─── Search ─────────────────────────────────────────────────────────

export function search<T>(
  items: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(lowerQuery);
    })
  );
}

// ─── Grouping ───────────────────────────────────────────────────────

export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const groupKey = String(item[key] ?? 'unknown');
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// ─── Deduplication ──────────────────────────────────────────────────

export function unique<T>(items: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

// ─── Debounce ───────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// ─── Throttle ───────────────────────────────────────────────────────

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ─── Retry ──────────────────────────────────────────────────────────

export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = 2 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(backoff, attempt))
      );
    }
  }

  throw new Error('Max retries exceeded');
}

// ─── Safe JSON Parse ────────────────────────────────────────────────

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ─── Deep Clone ─────────────────────────────────────────────────────

export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

// ─── Omit Helpers ───────────────────────────────────────────────────

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
