import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAdminCredentials } from './env';
import { getPrisma } from './prisma';
import { getAuthSecret, hasRuntimeAuthConfig } from './runtime-env';
import { safeEqual } from './security';

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
      if (user?.role) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      session.role = token.role;
      return session;
    },
  },
};
