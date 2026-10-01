import { describe, expect, it } from 'vitest';
import { CATEGORY_COLORS, DOMAIN_CATEGORIES } from '@exposure/shared';
import { CATEGORY_COLORS as localColors } from '../src/utils/colors.js';

describe('web ↔ shared contract', () => {
  it('uses the shared category colours, not a copy', () => {
    expect(localColors).toBe(CATEGORY_COLORS);
  });

  it('has a colour for every category', () => {
    for (const category of DOMAIN_CATEGORIES) {
      expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
