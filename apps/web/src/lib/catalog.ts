import { getPrisma } from './prisma';
import { hasRuntimeDatabaseUrl } from './runtime-env';

export type CatalogVariety = {
  id: string;
  name: string;
  species: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
};

export type CatalogResult = {
  varieties: CatalogVariety[];
  source: 'database' | 'starter';
};

export const starterVarieties: CatalogVariety[] = [
  {
    id: 'starter-crimson-flower-broad-bean',
    name: 'Crimson Flower Broad Bean',
    species: 'Vicia faba',
    description:
      'A striking heritage broad bean with crimson flowers, selected for exposed gardens and rich early-season flavour.',
    price: 3.25,
    stock: 24,
  },
  {
    id: 'starter-czar-runner-bean',
    name: 'Czar Runner Bean',
    species: 'Phaseolus coccineus',
    description:
      'Reliable white-flowered runner bean for fresh pods or drying. A practical staple for community seed saving.',
    price: 3.5,
    stock: 18,
  },
  {
    id: 'starter-green-in-snow-mustard',
    name: 'Green in Snow Mustard',
    species: 'Brassica juncea',
    description:
      'Hardy leafy mustard for autumn and winter harvests, with peppery leaves and strong regrowth after cutting.',
    price: 2.75,
    stock: 31,
  },
];

export async function getCatalogVarieties(): Promise<CatalogResult> {
  if (!hasRuntimeDatabaseUrl()) {
    return { varieties: starterVarieties, source: 'starter' };
  }

  try {
    const prisma = getPrisma();
    const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } });
    return { varieties, source: 'database' };
  } catch (error) {
    console.error('Falling back to starter catalogue after database read failed', error);
    return { varieties: starterVarieties, source: 'starter' };
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
