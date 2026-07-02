import { importSPKI, jwtVerify, type KeyLike } from 'jose';
import { config } from '../config.js';
import { UnauthorizedError } from './exceptions.js';
import type { JwtClaims } from '../types.js';

const ALG = 'RS256';

let publicKey: KeyLike | null = null;

async function getPublicKey(): Promise<KeyLike> {
  if (publicKey) return publicKey;
  if (!config.JWT_PUBLIC_KEY) {
    throw new UnauthorizedError('JWT public key not configured');
  }
  // Env files store the PEM with escaped newlines — restore real ones.
  const pem = config.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  publicKey = await importSPKI(pem, ALG);
  return publicKey;
}

export async function verifyJwt(token: string | undefined): Promise<JwtClaims> {
  if (!token) throw new UnauthorizedError('Missing token');
  const bearer = token.startsWith('Bearer ') ? token.slice(7) : token;
  try {
    const { payload } = await jwtVerify(bearer, await getPublicKey(), { algorithms: [ALG] });
    return payload as unknown as JwtClaims;
  } catch {
    throw new UnauthorizedError('Invalid token');
  }
}
