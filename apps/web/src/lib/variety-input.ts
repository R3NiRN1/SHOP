export type VarietyMutation = {
  name: string;
  slug: string;
  species?: string;
  description?: string;
  price?: string | null;
  stock?: number | null;
  published: boolean;
};

type VarietyMutationResult =
  | { ok: true; value: VarietyMutation }
  | { ok: false; error: string };

type ScalarResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const text = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

export const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const parsePrice = (value: unknown): ScalarResult<string | null> => {
  if (value === '' || value == null) return { ok: true, value: null };
  const numberValue = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 10000) {
    return { ok: false, error: 'Price must be between 0 and 10000.' };
  }
  return { ok: true, value: numberValue.toFixed(2) };
};

const parseStock = (value: unknown): ScalarResult<number | null> => {
  if (value === '' || value == null) return { ok: true, value: null };
  const numberValue = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 1_000_000) {
    return { ok: false, error: 'Stock must be a whole number between 0 and 1000000.' };
  }
  return { ok: true, value: numberValue };
};

export function parseVarietyMutation(input: unknown): VarietyMutationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'A JSON object is required.' };
  }

  const data = input as Record<string, unknown>;
  const name = text(data.name, 160);
  if (!name) return { ok: false, error: 'Name is required.' };

  const slug = slugify(text(data.slug, 160) || name);
  if (!slug) return { ok: false, error: 'A valid slug is required.' };

  const price = parsePrice(data.price);
  if (!price.ok) return { ok: false, error: price.error };
  const stock = parseStock(data.stock);
  if (!stock.ok) return { ok: false, error: stock.error };

  const species = text(data.species, 160);
  const description = text(data.description, 5000);

  return {
    ok: true,
    value: {
      name,
      slug,
      species: species || undefined,
      description: description || undefined,
      price: price.value,
      stock: stock.value,
      published: data.published === true,
    },
  };
}
