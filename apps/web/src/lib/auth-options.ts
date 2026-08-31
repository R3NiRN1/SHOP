import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAdminCredentials } from './env';
import { getPrisma } from './prisma';
import { getAuthSecret, hasRuntimeAuthConfig } from './runtime-env';
import { getAdminCredentialFingerprint, safeEqual } from './security';

const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const authOptions: AuthOptions = {
  secret: getAuthSecret() ?? undefined,
  session: { strategy: 'jwt', maxAge: ADMIN_SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: ADMIN_SESSION_MAX_AGE_SECONDS },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!hasRuntimeAuthConfig()) return null;

        const email = credentials?.email?.trim().toLowerCase() ?? '';
        const password = credentials?.password ?? '';
        const { email: adminEmail, password: adminPassword } = getAdminCredentials();

        if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) return null;

        const prisma = getPrisma();
        const user = await prisma.user.upsert({
          where: { email },
          update: { role: 'ADMIN' },
          create: { email, role: 'ADMIN' },
        });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const currentFingerprint = getAdminCredentialFingerprint();

      if (user?.role) {
        token.role = user.role;
        token.adminCredentialFingerprint = currentFingerprint ?? undefined;
      }

      if (
        token.role === 'ADMIN' &&
        (!currentFingerprint ||
          !token.adminCredentialFingerprint ||
          !safeEqual(token.adminCredentialFingerprint, currentFingerprint))
      ) {
        delete token.role;
        delete token.adminCredentialFingerprint;
      }

      return token;
    },
    async session({ session, token }) {
      session.role = token.role;
      return session;
    },
  },
};
