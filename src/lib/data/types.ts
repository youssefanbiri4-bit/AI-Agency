export interface DataResult<T> {
  data: T;
  error: string | null;
  isConfigured: boolean;
}

export function emptyDataResult<T>(data: T, isConfigured = false): DataResult<T> {
  return {
    data,
    error: null,
    isConfigured,
  };
}

export function errorDataResult<T>(
  data: T,
  error: string,
  isConfigured = true
): DataResult<T> {
  return {
    data,
    error,
    isConfigured,
  };
}
