import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, exportSPKI, SignJWT, type KeyLike } from 'jose';

// The JWT module reads config.JWT_PUBLIC_KEY at first verify, and config is
// parsed at import time — so the env var must be set before importing.
let verifyJwt: (token: string | undefined) => Promise<{ sub: string; roles?: string[] }>;
let privateKey: KeyLike;

beforeAll(async () => {
  const { publicKey, privateKey: priv } = await generateKeyPair('RS256');
  privateKey = priv;
  process.env.JWT_PUBLIC_KEY = await exportSPKI(publicKey);
  ({ verifyJwt } = await import('../src/core/jwt.js'));
});

async function sign(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

describe('verifyJwt (chat handshake + HTTP auth)', () => {
  it('accepts a valid RS256 token and returns claims', async () => {
    const token = await sign({ sub: 'user-1', roles: ['admin'] });
    const claims = await verifyJwt(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.roles).toEqual(['admin']);
  });

  it('accepts a Bearer-prefixed token', async () => {
    const token = await sign({ sub: 'user-2' });
    const claims = await verifyJwt(`Bearer ${token}`);
    expect(claims.sub).toBe('user-2');
  });

  it('rejects a missing token', async () => {
    await expect(verifyJwt(undefined)).rejects.toThrow();
  });

  it('rejects a garbage token', async () => {
    await expect(verifyJwt('not-a-jwt')).rejects.toThrow();
  });

  it('rejects a token signed by a different key', async () => {
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const forged = await new SignJWT({ sub: 'attacker' })
      .setProtectedHeader({ alg: 'RS256' })
      .setExpirationTime('5m')
      .sign(otherKey);
    await expect(verifyJwt(forged)).rejects.toThrow();
  });
});
