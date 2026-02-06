import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../../../lib/prisma';
import { env } from '../../../../env';

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  secret: env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase() ?? '';
        const password = credentials?.password ?? '';
        const adminEmail = env.ADMIN_EMAIL.toLowerCase();
        const adminPassword = env.ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) return null;
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
