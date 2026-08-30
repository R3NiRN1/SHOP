import { createHash, timingSafeEqual } from 'node:crypto';
import type { Session } from 'next-auth';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export const safeEqual = (left: string, right: string) => timingSafeEqual(digest(left), digest(right));

export const isAdminSession = (session: Session | null) => session?.role === 'ADMIN';
