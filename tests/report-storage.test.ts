import { describe, expect, it } from 'vitest';
import { verifySharePassword } from '@/lib/reports/report-storage';
import { randomBytes, scryptSync } from 'node:crypto';

function hashForTest(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

describe('report-storage share password', () => {
  it('accepts the correct password', () => {
    const stored = hashForTest('client-secret');
    expect(verifySharePassword('client-secret', stored)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const stored = hashForTest('client-secret');
    expect(verifySharePassword('wrong-password', stored)).toBe(false);
  });
});