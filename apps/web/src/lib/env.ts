const isCi = process.env.CI === 'true' || process.env.CI === '1';

const requiredEnv = (key: string) => {
  const value = process.env[key];
  if (value) return value;
  if (isCi) return `ci-placeholder-${key.toLowerCase()}`;
  throw new Error(`Missing required environment variable: ${key}`);
};

export const getAdminCredentials = () => ({
  email: requiredEnv('ADMIN_EMAIL'),
  password: requiredEnv('ADMIN_PASSWORD'),
});

export const getDatabaseUrl = () => requiredEnv('DATABASE_URL');
