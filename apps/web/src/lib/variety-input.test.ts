import { describe, expect, it } from 'vitest';
import { parseVarietyMutation, slugify } from './variety-input';

describe('variety input', () => {
  it('creates a stable slug from the name', () => {
    expect(slugify('  Czar Runner Bean!  ')).toBe('czar-runner-bean');
  });

  it('normalises valid commercial fields', () => {
    const result = parseVarietyMutation({ name: 'Czar Runner Bean', price: '3.5', stock: '18', published: true });
    expect(result).toEqual({ ok: true, value: { name: 'Czar Runner Bean', slug: 'czar-runner-bean', species: undefined, description: undefined, price: '3.50', stock: 18, published: true } });
  });

  it('rejects invalid money and inventory', () => {
    expect(parseVarietyMutation({ name: 'Bean', price: '-1' }).ok).toBe(false);
    expect(parseVarietyMutation({ name: 'Bean', stock: '1.2' }).ok).toBe(false);
  });

  it('does not publish unless explicitly true', () => {
    const result = parseVarietyMutation({ name: 'Draft Bean', published: 'true' });
    expect(result.ok && result.value.published).toBe(false);
  });
});
