import { describe, expect, it } from 'vitest';
import { safeEqual } from './security';

describe('safeEqual', () => {
  it('compares credential strings without direct equality', () => {
    expect(safeEqual('correct horse battery staple', 'correct horse battery staple')).toBe(true);
    expect(safeEqual('correct horse battery staple', 'wrong')).toBe(false);
  });
});
