import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function parseMfaEncryptionKey(
  raw: string | undefined,
  nodeEnv: string,
): Buffer {
  if (!raw) {
    if (nodeEnv === 'production') {
      throw new Error('ADMIN_MFA_ENCRYPTION_KEY is required in production');
    }
    return createHash('sha256').update('dev-only-admin-mfa-encryption-key').digest();
  }

  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  try {
    const fromB64 = Buffer.from(trimmed, 'base64');
    if (fromB64.length === 32) {
      return fromB64;
    }
  } catch {
    // fall through
  }

  throw new Error(
    'ADMIN_MFA_ENCRYPTION_KEY must be 32-byte hex (64 chars) or base64',
  );
}

/** AES-256-GCM; returns `iv.tag.ciphertext` (each base64). */
export function encryptAesGcm(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptAesGcm(payload: string, key: Buffer): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
