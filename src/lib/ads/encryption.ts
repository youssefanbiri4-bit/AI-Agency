import crypto from 'crypto';

const TOKEN_FORMAT_VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Token encryption helpers can only run on the server.');
  }
}

function getTokenEncryptionKey() {
  assertServerOnly();

  const rawKey = process.env.AD_TOKEN_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    throw new Error('AD_TOKEN_ENCRYPTION_KEY is required for ad token encryption.');
  }

  const key = Buffer.from(rawKey, 'base64');

  if (key.length !== KEY_BYTES) {
    throw new Error('AD_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 key.');
  }

  return key;
}

function encodePart(value: Buffer) {
  return value.toString('base64url');
}

function decodePart(value: string) {
  return Buffer.from(value, 'base64url');
}

export function encryptToken(plainText: string): string {
  assertServerOnly();

  if (!plainText) {
    throw new Error('Token value is required for encryption.');
  }

  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_FORMAT_VERSION,
    encodePart(iv),
    encodePart(authTag),
    encodePart(encrypted),
  ].join(':');
}

export function decryptToken(cipherText: string): string {
  assertServerOnly();

  const [version, encodedIv, encodedAuthTag, encodedEncrypted] = cipherText.split(':');

  if (
    version !== TOKEN_FORMAT_VERSION ||
    !encodedIv ||
    !encodedAuthTag ||
    !encodedEncrypted
  ) {
    throw new Error('Encrypted token format is invalid.');
  }

  const key = getTokenEncryptionKey();
  const iv = decodePart(encodedIv);
  const authTag = decodePart(encodedAuthTag);
  const encrypted = decodePart(encodedEncrypted);

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Encrypted token metadata is invalid.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
