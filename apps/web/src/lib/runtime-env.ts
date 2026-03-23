const CI_PLACEHOLDER_DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public';
const CI_PLACEHOLDER_AUTH_SECRET = 'ci-placeholder-not-for-prod';

const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

export const getAuthSecret = () => process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;

export const isPlaceholderDatabaseUrl = (value = process.env.DATABASE_URL) => value === CI_PLACEHOLDER_DATABASE_URL;
export const isPlaceholderAuthSecret = (value = getAuthSecret()) => value === CI_PLACEHOLDER_AUTH_SECRET;

export const hasRuntimeDatabaseUrl = () => isNonEmpty(process.env.DATABASE_URL) && !isPlaceholderDatabaseUrl();

export const hasRuntimeAuthConfig = () => {
  const authSecret = getAuthSecret();
  return isNonEmpty(authSecret) && !isPlaceholderAuthSecret(authSecret);
};

export const authRuntimeState = () => ({
  enabled: hasRuntimeAuthConfig(),
  reason: hasRuntimeAuthConfig()
    ? 'configured'
    : isPlaceholderAuthSecret()
      ? 'placeholder-secret'
      : 'missing-secret',
});
