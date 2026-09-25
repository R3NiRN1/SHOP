import { queryVarieties, type CatalogueQuery } from './catalog-query';
import { hasRuntimeDatabaseUrl, isStarterCatalogEnabled } from './runtime-env';

export type CatalogVariety = {
  id: string;
  slug: string;
  name: string;
  species: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  published: boolean;
  reserved?: number;
  archived?: boolean;
  inventoryVersion?: number;
  updatedAt?: Date | string;
};

export type CatalogResult = {
  varieties: CatalogVariety[];
  source: 'database' | 'starter' | 'unavailable';
  total?: number;
  page?: number;
  pageSize?: number;
};

type DatabaseVariety = Omit<CatalogVariety, 'price'> & {
  price: { toString(): string } | number | null;
};

export const serializeVariety = (variety: DatabaseVariety): CatalogVariety => ({
  ...variety,
  price: variety.price == null ? null : Number(variety.price.toString()),
});

export const starterVarieties: CatalogVariety[] = [
  {
    id: 'starter-crimson-flower-broad-bean',
    slug: 'crimson-flower-broad-bean-demo',
    name: 'Crimson Flower Broad Bean — demo',
    species: 'Vicia faba',
    description: 'Demonstration catalogue entry. Replace with verified grower, provenance, price and stock data before publication.',
    price: 3.25,
    stock: 24,
    published: true,
  },
  {
    id: 'starter-czar-runner-bean',
    slug: 'czar-runner-bean-demo',
    name: 'Czar Runner Bean — demo',
    species: 'Phaseolus coccineus',
    description: 'Demonstration catalogue entry. Replace with verified grower, provenance, price and stock data before publication.',
    price: 3.5,
    stock: 18,
    published: true,
  },
  {
    id: 'starter-green-in-snow-mustard',
    slug: 'green-in-snow-mustard-demo',
    name: 'Green in Snow Mustard — demo',
    species: 'Brassica juncea',
    description: 'Demonstration catalogue entry. Replace with verified grower, provenance, price and stock data before publication.',
    price: 2.75,
    stock: 31,
    published: true,
  },
];

export async function getCatalogVarieties(query: CatalogueQuery = {}, pageSize = 24): Promise<CatalogResult> {
  if (!hasRuntimeDatabaseUrl()) {
    return isStarterCatalogEnabled()
      ? { varieties: starterVarieties, source: 'starter' }
      : { varieties: [], source: 'unavailable' };
  }

  try {
    const { rows, ...pagination } = await queryVarieties(query, false, pageSize);
    return { varieties: rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name,
      species: row.species, description: row.description, price: row.price === null ? null : Number(row.price.toString()),
      stock: row.stock === null ? null : row.stock - row.reserved, published: row.published })), source: 'database', ...pagination };
  } catch (error) {
    console.error('Catalogue database read failed', error);
    return { varieties: [], source: 'unavailable' };
  }
}

export function formatCurrency(value: number | null) {
  if (value == null) return 'Price coming soon';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

export function formatStock(value: number | null) {
  if (value == null) return 'Stock TBC';
  if (value <= 0) return 'Sold out';
  if (value <= 5) return `Only ${value} left`;
  return `${value} packets available`;
}
