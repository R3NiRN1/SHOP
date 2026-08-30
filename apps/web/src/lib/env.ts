const requiredEnv = (key: string) => {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new Error(`Missing required environment variable: ${key}`);
};

export const getAdminCredentials = () => ({
  email: requiredEnv('ADMIN_EMAIL').trim().toLowerCase(),
  password: requiredEnv('ADMIN_PASSWORD'),
});

export const getDatabaseUrl = () => requiredEnv('DATABASE_URL');
