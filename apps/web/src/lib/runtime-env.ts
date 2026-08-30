const CI_PLACEHOLDER_DATABASE_URLS = new Set([
  'postgresql://ci:ci@localhost:5432/ci?schema=public',
  'file:./ci.db',
]);
const CI_PLACEHOLDER_AUTH_SECRET = 'ci-placeholder-not-for-prod';
const CI_PLACEHOLDER_ADMIN_EMAILS = new Set(['admin@example.com', 'admin@example.org']);
const CI_PLACEHOLDER_ADMIN_PASSWORDS = new Set(['admin', 'password']);

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const getAuthSecret = () => process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
export const getConfiguredAdminEmail = () => process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? null;
export const getConfiguredAdminPassword = () => process.env.ADMIN_PASSWORD ?? null;
export const getShopContactEmail = () => process.env.SHOP_CONTACT_EMAIL?.trim().toLowerCase() ?? null;

export const isPlaceholderDatabaseUrl = (value = process.env.DATABASE_URL) =>
  typeof value === 'string' && CI_PLACEHOLDER_DATABASE_URLS.has(value);
export const isPlaceholderAuthSecret = (value = getAuthSecret()) => value === CI_PLACEHOLDER_AUTH_SECRET;
export const isPlaceholderAdminEmail = (value = getConfiguredAdminEmail()) =>
  typeof value === 'string' && CI_PLACEHOLDER_ADMIN_EMAILS.has(value);
export const isPlaceholderAdminPassword = (value = getConfiguredAdminPassword()) =>
  typeof value === 'string' && CI_PLACEHOLDER_ADMIN_PASSWORDS.has(value);

export const hasRuntimeDatabaseUrl = () => isNonEmpty(process.env.DATABASE_URL) && !isPlaceholderDatabaseUrl();

export const authRuntimeState = () => {
  const issues: string[] = [];
  const authSecret = getAuthSecret();
  const adminEmail = getConfiguredAdminEmail();
  const adminPassword = getConfiguredAdminPassword();

  if (!isNonEmpty(authSecret) || isPlaceholderAuthSecret(authSecret)) issues.push('auth-secret');
  if (!isNonEmpty(adminEmail) || isPlaceholderAdminEmail(adminEmail)) issues.push('admin-email');
  if (!isNonEmpty(adminPassword) || isPlaceholderAdminPassword(adminPassword)) issues.push('admin-password');
  if (!hasRuntimeDatabaseUrl()) issues.push('database');

  return { enabled: issues.length === 0, issues };
};

export const hasRuntimeAuthConfig = () => authRuntimeState().enabled;

export const isStarterCatalogEnabled = () =>
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_STARTER_CATALOG === 'true';

export const contactRuntimeState = () => {
  const email = getShopContactEmail();
  const configured = isNonEmpty(email) && !email.endsWith('@example.com') && !email.endsWith('@example.org') && !email.endsWith('@example.invalid');
  return { configured, email: configured ? email : null };
};
