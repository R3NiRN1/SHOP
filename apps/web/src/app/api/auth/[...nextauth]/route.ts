import NextAuth from 'next-auth';
import { authOptions } from '../../../../lib/auth-options';
import { checkRateLimit, getClientKey } from '../../../../lib/rate-limit';
import { authRuntimeState, hasRuntimeAuthConfig } from '../../../../lib/runtime-env';

export const dynamic = 'force-dynamic';

const nextAuthHandler = NextAuth(authOptions);

const authUnavailableResponse = () => {
  const { issues } = authRuntimeState();
  return Response.json(
    { error: 'Auth is not configured for runtime use.', missing: issues },
    { status: 503 },
  );
};

export async function GET(request: Request) {
  if (!hasRuntimeAuthConfig()) return authUnavailableResponse();
  return nextAuthHandler(request);
}

export async function POST(request: Request) {
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
      { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
    );
  }

  return nextAuthHandler(request);
}
