import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '../../../../lib/auth-options';
import { checkRateLimit, getClientKey } from '../../../../lib/rate-limit';
import { hasRuntimeAuthConfig } from '../../../../lib/runtime-env';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

const authUnavailableResponse = () =>
  Response.json(
    { error: 'Authentication service is unavailable.' },
    { status: 503, headers: noStoreHeaders },
  );

export async function GET(request: NextRequest, context: AuthRouteContext) {
  if (!hasRuntimeAuthConfig()) return authUnavailableResponse();
  return NextAuth(request, context, authOptions);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  if (!hasRuntimeAuthConfig()) return authUnavailableResponse();

  const path = new URL(request.url).pathname;
  const credentialsAttempt = path.includes('/callback/credentials');
  const result = checkRateLimit(`auth:${getClientKey(request)}:${credentialsAttempt ? 'credentials' : 'general'}`, {
    limit: credentialsAttempt ? 5 : 60,
    windowMs: credentialsAttempt ? 15 * 60_000 : 60_000,
  });

  if (!result.allowed) {
    return Response.json(
      { error: 'Too many authentication requests. Try again later.' },
      { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(result.retryAfterSeconds) } },
    );
  }

  return NextAuth(request, context, authOptions);
}
