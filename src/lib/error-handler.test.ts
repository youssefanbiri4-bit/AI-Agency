import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError, ErrorLevel, handleError, createErrorResponse, validateRequired, validateNotEmpty } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.level).toBe(ErrorLevel.MEDIUM);
    });

    it('should create error with custom values', () => {
      const error = new AppError('Not found', 404, ErrorLevel.LOW, { resource: 'user' });
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.level).toBe(ErrorLevel.LOW);
      expect(error.metadata).toEqual({ resource: 'user' });
    });
  });

  describe('handleError', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Forbidden', 403, ErrorLevel.HIGH);
      const result = handleError(error);

      expect(result.message).toBe('Forbidden');
      expect(result.statusCode).toBe(403);
      expect(result.level).toBe(ErrorLevel.HIGH);
    });

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');
      const result = handleError(error);

      expect(result.message).toBe('Something went wrong');
      expect(result.statusCode).toBe(500);
      expect(result.level).toBe(ErrorLevel.MEDIUM);
    });

    it('should handle unknown error types', () => {
      const error = 'String error';
      const result = handleError(error);

      expect(result.message).toBe('String error');
      expect(result.statusCode).toBe(500);
    });

    it('should report to Sentry', () => {
      const error = new AppError('Server error', 500, ErrorLevel.CRITICAL);
      handleError(error, { endpoint: '/api/test', requestId: 'req-123' });

      expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with correct status', async () => {
      const error = new AppError('Bad request', 400, ErrorLevel.LOW);
      const response = createErrorResponse(error);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Bad request');
    });

    it('should include request ID in response', async () => {
      const error = new Error('Test');
      const response = createErrorResponse(error, { requestId: 'req-123' });

      const data = await response.json();
      expect(data.requestId).toBe('req-123');
    });
  });

  describe('Validation helpers', () => {
    it('validateRequired should pass for truthy values', () => {
      expect(validateRequired('value', 'field')).toBe('value');
      expect(validateRequired(123, 'field')).toBe(123);
      expect(validateRequired({}, 'field')).toEqual({});
    });

    it('validateRequired should throw for falsy values', () => {
      expect(() => validateRequired(null, 'field')).toThrow();
      expect(() => validateRequired(undefined, 'field')).toThrow();
      expect(() => validateRequired('', 'field')).toThrow();
    });

    it('validateNotEmpty should pass for non-empty', () => {
      expect(validateNotEmpty('value', 'field')).toBe('value');
      expect(validateNotEmpty([1, 2], 'field')).toEqual([1, 2]);
    });

    it('validateNotEmpty should throw for empty', () => {
      expect(() => validateNotEmpty('', 'field')).toThrow();
      expect(() => validateNotEmpty([], 'field')).toThrow();
    });
  });
});
