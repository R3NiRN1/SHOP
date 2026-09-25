export class CommerceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommerceError('Invalid request.');
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, max = 250, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new CommerceError(`${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

export function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new CommerceError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

export function requestKey(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) throw new CommerceError('A valid request key is required.');
  return value;
}

export type CartItem = { varietyId: string; quantity: number };

export function parseItems(value: unknown): CartItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new CommerceError('Choose between 1 and 30 varieties.');
  const items = value.map((item) => {
    const row = record(item);
    return { varietyId: text(row.varietyId, 'Variety', 100), quantity: integer(row.quantity, 'Quantity', 1, 1000) };
  }).sort((a, b) => a.varietyId.localeCompare(b.varietyId));
  if (new Set(items.map((item) => item.varietyId)).size !== items.length) throw new CommerceError('Combine duplicate varieties into one line.');
  return items;
}

export function parseOrder(value: unknown) {
  const data = record(value);
  const email = text(data.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommerceError('Enter a valid email address.');
  return {
    items: parseItems(data.items), email, requestKey: requestKey(data.requestKey),
    customerName: text(data.customerName ?? '', 'Customer name', 160, false),
    notes: text(data.notes ?? '', 'Notes', 2000, false),
  };
}

export function toPence(value: { toString(): string } | string | number) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.toString());
  if (!match) throw new CommerceError('A valid price is required.');
  const result = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return integer(result, 'Price', 0, 1_000_000);
}

export const formatPence = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);
