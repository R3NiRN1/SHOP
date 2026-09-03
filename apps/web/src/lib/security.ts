import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Session } from 'next-auth';
import { getAuthSecret, getConfiguredAdminEmail, getConfiguredAdminPassword } from './runtime-env';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export const safeEqual = (left: string, right: string) => timingSafeEqual(digest(left), digest(right));

export const getAdminCredentialFingerprint = () => {
  const secret = getAuthSecret();
  const email = getConfiguredAdminEmail();
  const password = getConfiguredAdminPassword();
  if (!secret || !email || !password) return null;

  return createHmac('sha256', secret)
    .update(email, 'utf8')
    .update('\0', 'utf8')
    .update(password, 'utf8')
    .digest('hex');
};

export const isSameOriginMutation = (request: Request) => {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const origin = request.headers.get('origin');
  if (!origin) return fetchSite === 'same-origin' || process.env.NODE_ENV !== 'production';

  try {
    const allowedOrigins = new Set([new URL(request.url).origin]);
    if (process.env.NEXTAUTH_URL) allowedOrigins.add(new URL(process.env.NEXTAUTH_URL).origin);
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
};

export const isAdminSession = (session: Session | null) => session?.role === 'ADMIN';
