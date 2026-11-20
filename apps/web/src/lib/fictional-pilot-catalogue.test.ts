import { describe, expect, it } from 'vitest';
import { fictionalPilotCatalogue } from './fictional-pilot-catalogue';

describe('fictional pilot catalogue', () => {
  it('contains 18 uniquely identified, unmistakably fictional listings', () => {
    const rows = fictionalPilotCatalogue();
    expect(rows).toHaveLength(18);
    expect(new Set(rows.map(row => row.slug)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.slug).toMatch(/^pilot-fictional-[a-z-]+$/);
      expect(row.name).toMatch(/^\[FICTIONAL PILOT\]/);
      expect(row.description).toContain('Not a real seed offering');
      expect(row.species).toBeTruthy();
      if (row.price !== null) expect(row.price).toMatch(/^\d+\.\d{2}$/);
      if (row.stock !== null) {
        expect(Number.isInteger(row.stock)).toBe(true);
        expect(row.stock).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('covers public stock states, unknown pricing and unpublished entries', () => {
    const rows = fictionalPilotCatalogue();
    const visible = rows.filter(row => row.published);
    expect(visible.some(row => row.stock === 0)).toBe(true);
    expect(visible.some(row => row.stock === 1)).toBe(true);
    expect(visible.some(row => row.stock === null)).toBe(true);
    expect(visible.some(row => row.stock !== null && row.stock > 5)).toBe(true);
    expect(visible.some(row => row.price === null)).toBe(true);
    expect(rows.some(row => !row.published)).toBe(true);
  });

  it('returns fresh objects on each call', () => {
    expect(fictionalPilotCatalogue()[0]).not.toBe(fictionalPilotCatalogue()[0]);
  });
});
