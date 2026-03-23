const isCi = process.env.CI === 'true';

const requireEnv = (name: string, fallback: string) => {
  const value = process.env[name];
  if (value && value.length > 0) {
    return value;
  }
  if (isCi) {
    return fallback;
  }
  throw new Error(`Missing required environment variable: ${name}`);
};

export const env = {
  AUTH_SECRET: requireEnv('AUTH_SECRET', 'ci-placeholder-not-for-prod'),
  ADMIN_EMAIL: requireEnv('ADMIN_EMAIL', 'admin@example.com'),
  ADMIN_PASSWORD: requireEnv('ADMIN_PASSWORD', 'admin'),
  DATABASE_URL: requireEnv('DATABASE_URL', 'file:./ci.db'),
};
