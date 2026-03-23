import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import { getAdminCredentials } from '../../../../lib/env';

const prisma = new PrismaClient();
import prisma from '../../../../lib/prisma';
import { authRuntimeState, getAuthSecret, hasRuntimeAuthConfig } from '../../../../lib/runtime-env';

export const authOptions: AuthOptions = {
  secret: getAuthSecret() ?? undefined,
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!hasRuntimeAuthConfig()) return null;

        const email = credentials?.email?.toLowerCase() ?? '';
        const password = credentials?.password ?? '';
        const { email: adminEmail, password: adminPassword } = getAdminCredentials();
        if (email !== adminEmail || password !== adminPassword) return null;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, role: 'ADMIN' },
        });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session) {
        (session as any).role = (token as any).role;
      }
      return session;
    },
  },
};

const nextAuthHandler = NextAuth(authOptions);

const authUnavailableResponse = () => {
  const { reason } = authRuntimeState();
  return Response.json(
    {
      error: 'Auth is not configured for runtime use.',
      reason,
    },
    { status: 503 },
  );
};

export async function GET(request: Request) {
  if (!hasRuntimeAuthConfig()) {
    return authUnavailableResponse();
  }

  return nextAuthHandler(request);
}

export async function POST(request: Request) {
  if (!hasRuntimeAuthConfig()) {
    return authUnavailableResponse();
  }

  return nextAuthHandler(request);
}
