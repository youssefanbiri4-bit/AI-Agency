import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, LogLevel, reportAppError, reportAppEvent } from '@/lib/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('req-123', 'trace-456');
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('basic logging', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { key: 'value' });
      expect(console.debug).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });
      expect(console.info).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Warning message', { key: 'value' });
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message', { key: 'value' });
      expect(console.error).toHaveBeenCalled();
    });

    it('should log fatal messages', () => {
      logger.fatal('Fatal message', { key: 'value' });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('child logger', () => {
    it('should create child logger with same request ID', () => {
      const child = logger.child('new-trace');
      expect(child).toBeInstanceOf(Logger);
    });

    it('child logger should preserve request context', () => {
      const child = logger.child('new-trace');
      child.info('Child message');
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('redaction', () => {
    it('should redact sensitive data', () => {
      const sensitiveData = {
        username: 'user',
        password: 'secret123',
        api_key: 'abc123',
        email: 'user@example.com',
      };

      logger.info('Request data', sensitiveData);
      expect(console.info).toHaveBeenCalled();

      const calls = (console.info as any).mock.calls;
      const logData = calls[calls.length - 1][0];

      // Check that sensitive fields are redacted
      expect(JSON.stringify(logData)).toContain('[REDACTED]');
    });

    it('should preserve email domain', () => {
      const data = {
        email: 'user@example.com',
      };

      logger.info('User data', data);
      const calls = (console.info as any).mock.calls;
      const logData = calls[calls.length - 1][0];
      const output = JSON.stringify(logData);

      // Should contain redacted email but preserve domain
      expect(output).toContain('[REDACTED]');
      expect(output).toContain('@example.com');
    });
  });

  describe('reportAppError', () => {
    it('should report Error objects', () => {
      const error = new Error('Test error');
      reportAppError('Failed to process', error);

      expect(console.error).toHaveBeenCalled();
    });

    it('should report unknown errors', () => {
      reportAppError('Failed to process', 'string error');

      expect(console.error).toHaveBeenCalled();
    });

    it('should include metadata', () => {
      const error = new Error('Test');
      reportAppError('Failed', error, { userId: 'user-123' });

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('reportAppEvent', () => {
    it('should report events', () => {
      reportAppEvent('user_login', { userId: 'user-123' });

      expect(console.info).toHaveBeenCalled();
      const calls = (console.info as any).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(JSON.stringify(lastCall)).toContain('user_login');
    });

    it('should report events without data', () => {
      reportAppEvent('app_start');

      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('LogLevel enum', () => {
    it('should have all required log levels', () => {
      expect(LogLevel.Debug).toBe('debug');
      expect(LogLevel.Info).toBe('info');
      expect(LogLevel.Warn).toBe('warn');
      expect(LogLevel.Error).toBe('error');
      expect(LogLevel.Fatal).toBe('fatal');
    });
  });
});
