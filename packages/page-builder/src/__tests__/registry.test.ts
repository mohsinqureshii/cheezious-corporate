import { describe, expect, it } from 'vitest';

import {
  BLOCK_SPECS,
  collectMediaReferences,
  collectPageReferences,
  defaultBlockData,
  extractTextFromBlocks,
  getBlockSpec,
  validateBlock,
  validateComposition,
} from '../registry';

describe('block registry', () => {
  it('declares every block exactly once with a unique key', () => {
    const keys = BLOCK_SPECS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(55);
  });

  it('gives every block a name, description, icon and category', () => {
    for (const block of BLOCK_SPECS) {
      expect(block.name.length, block.key).toBeGreaterThan(0);
      expect(block.description.length, block.key).toBeGreaterThan(10);
      expect(block.icon.length, block.key).toBeGreaterThan(0);
      expect(block.category.length, block.key).toBeGreaterThan(0);
    }
  });

  it('produces usable defaults for every block', () => {
    for (const block of BLOCK_SPECS) {
      expect(() => defaultBlockData(block.key), block.key).not.toThrow();
    }
  });
});

describe('block validation', () => {
  it('accepts a well-formed hero', () => {
    const result = validateBlock('HeroEditorial', {
      headline: 'Built here. Growing here.',
      standfirst: 'A short standfirst.',
      image: { assetId: 'asset_1' },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown block type', () => {
    const result = validateBlock('NotARealBlock', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toMatch(/Unknown block type/);
  });

  it('rejects a hero with no headline', () => {
    const result = validateBlock('HeroEditorial', { standfirst: 'Missing the headline.' });
    expect(result.ok).toBe(false);
  });

  it('applies schema defaults so the renderer never sees undefined', () => {
    const result = validateBlock('KPIGrid', { statistics: [{ value: '12', label: 'Cities' }] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.columns).toBe('3');
      expect(result.data.tone).toBe('light');
      expect((result.data.statistics as Array<Record<string, unknown>>)[0]?.isPlaceholder).toBe(false);
    }
  });

  it('refuses a link that is both internal and external', () => {
    const both = validateBlock('CTABand', {
      headline: 'Work with us',
      primaryLink: { label: 'Go', pageId: 'p1', externalUrl: 'https://example.com' },
    });
    expect(both.ok).toBe(false);

    const neither = validateBlock('CTABand', { headline: 'Work with us', primaryLink: { label: 'Go' } });
    expect(neither.ok).toBe(false);

    const internal = validateBlock('CTABand', {
      headline: 'Work with us',
      primaryLink: { label: 'Go', pageId: 'p1' },
    });
    expect(internal.ok).toBe(true);
  });

  it('enforces collection size limits', () => {
    const tooMany = validateBlock('OperationsFlow', {
      steps: Array.from({ length: 12 }, (_, i) => ({ label: `Step ${i}` })),
    });
    expect(tooMany.ok).toBe(false);

    const tooFew = validateBlock('OperationsFlow', { steps: [{ label: 'Only one' }] });
    expect(tooFew.ok).toBe(false);
  });

  it('requires a poster image on video heroes', () => {
    expect(validateBlock('HeroVideo', { headline: 'Our operations' }).ok).toBe(false);
    expect(validateBlock('HeroVideo', { headline: 'Our operations', poster: { assetId: 'a1' } }).ok).toBe(true);
  });
});

describe('page composition', () => {
  const hero = { blockKey: 'HeroEditorial', data: { headline: 'A headline' } };
  const text = { blockKey: 'RichText', data: { body: '<p>Body</p>' } };

  it('accepts a valid composition and preserves order', () => {
    const result = validateComposition([hero, text]);
    expect(result.ok).toBe(true);
    expect(result.blocks.map((b) => b.blockKey)).toEqual(['HeroEditorial', 'RichText']);
    expect(result.blocks[1]?.sortOrder).toBe(1);
  });

  it('refuses two heroes on one page', () => {
    const result = validateComposition([hero, { blockKey: 'HeroEditorial', data: { headline: 'Second' } }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.message).toMatch(/Only one/);
  });

  it('refuses a hero that is not the first block', () => {
    const result = validateComposition([text, hero]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.message).toMatch(/must be the first block/);
  });

  it('reports the index of each invalid block', () => {
    const result = validateComposition([hero, { blockKey: 'KPIGrid', data: { statistics: [] } }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.index).toBe(1);
    expect(result.errors[0]?.blockKey).toBe('KPIGrid');
  });
});

describe('reference extraction', () => {
  it('finds nested media references', () => {
    const found = collectMediaReferences({
      image: { assetId: 'a1' },
      pillars: [{ image: { assetId: 'a2' } }, { title: 'No image' }],
      assetIds: ['a3', 'a4'],
    });
    expect([...found].sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('finds internal page references so link integrity can be checked', () => {
    const found = collectPageReferences({
      primaryLink: { pageId: 'p1' },
      links: [{ pageId: 'p2' }, { externalUrl: 'https://example.com' }],
    });
    expect([...found].sort()).toEqual(['p1', 'p2']);
  });

  it('extracts prose for the search index but skips identifiers', () => {
    const text = extractTextFromBlocks([
      { blockKey: 'HeroEditorial', data: { headline: 'Built here and growing', tone: 'dark', image: { assetId: 'asset_123' } } },
      { blockKey: 'RichText', data: { body: 'Our supply chain moves food across the country.' } },
    ]);
    expect(text).toContain('Built here and growing');
    expect(text).toContain('supply chain');
    expect(text).not.toContain('asset_123');
    expect(text).not.toContain('dark');
  });
});

describe('block metadata used by the CMS', () => {
  it('marks heroes as singletons so an editor cannot stack them', () => {
    for (const key of ['HeroEditorial', 'HeroMedia', 'HeroVideo', 'HeroMinimal']) {
      expect(getBlockSpec(key)?.singleton, key).toBe(true);
    }
  });

  it('marks full-bleed blocks so the renderer skips the container', () => {
    expect(getBlockSpec('KPIBand')?.fullBleed).toBe(true);
    expect(getBlockSpec('RichText')?.fullBleed).toBeUndefined();
  });
});
