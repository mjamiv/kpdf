import { describe, it, expect } from 'vitest';
import { createLocalAIProvider, createAIManager } from './aiFeatures';
import type { Annotation } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeText(id: string, x: number, y: number, text = 'hello'): Annotation {
  return {
    id, zIndex: 1, type: 'text', x, y, text, fontSize: 0.02,
    color: '#ff0000', author: 'tester',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', locked: false,
  };
}

function makeRect(id: string, x: number, y: number, color = '#00ff00'): Annotation {
  return {
    id, zIndex: 1, type: 'rectangle', x, y, width: 0.1, height: 0.1, thickness: 2,
    color, author: 'tester',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', locked: false,
  };
}

function makeArrow(id: string, sx: number, sy: number, ex: number, ey: number): Annotation {
  return {
    id, zIndex: 1, type: 'arrow', start: { x: sx, y: sy }, end: { x: ex, y: ey },
    thickness: 2, headSize: 10, color: '#0000ff', author: 'tester',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', locked: false,
  };
}

function makeMeasurement(id: string): Annotation {
  return {
    id, zIndex: 1, type: 'measurement',
    start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 },
    thickness: 2, scale: 1, unit: 'ft',
    color: '#333', author: 'tester',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', locked: false,
  };
}

function makeStamp(id: string): Annotation {
  return {
    id, zIndex: 1, type: 'stamp',
    x: 0.3, y: 0.3, width: 0.1, height: 0.1,
    stampId: 'approved', label: 'APPROVED',
    color: '#00ff00', author: 'tester',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', locked: false,
  };
}

// ---------------------------------------------------------------------------
// AIManager tests
// ---------------------------------------------------------------------------

describe('AIManager', () => {
  it('registers and retrieves a provider', () => {
    const mgr = createAIManager();
    const provider = createLocalAIProvider();
    mgr.registerProvider(provider);
    expect(mgr.getProvider('local-heuristic')).toBe(provider);
  });

  it('auto-sets first provider as default', () => {
    const mgr = createAIManager();
    mgr.registerProvider(createLocalAIProvider());
    expect(mgr.getDefault()?.id).toBe('local-heuristic');
  });

  it('setDefault changes provider', () => {
    const mgr = createAIManager();
    mgr.registerProvider(createLocalAIProvider());
    const custom = { ...createLocalAIProvider(), id: 'custom', name: 'Custom' };
    mgr.registerProvider(custom);
    mgr.setDefault('custom');
    expect(mgr.getDefault()?.id).toBe('custom');
  });

  it('setDefault throws for unknown provider', () => {
    const mgr = createAIManager();
    expect(() => mgr.setDefault('nope')).toThrow('not registered');
  });

  it('lists all providers', () => {
    const mgr = createAIManager();
    mgr.registerProvider(createLocalAIProvider());
    expect(mgr.listProviders()).toHaveLength(1);
  });

  it('returns undefined for unknown provider', () => {
    const mgr = createAIManager();
    expect(mgr.getProvider('nope')).toBeUndefined();
  });

  it('returns undefined default when empty', () => {
    const mgr = createAIManager();
    expect(mgr.getDefault()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Local AI Provider - classify
// ---------------------------------------------------------------------------

describe('createLocalAIProvider — classify', () => {
  const provider = createLocalAIProvider();

  it('classifies text in header area as Title / Header Note', async () => {
    const results = await provider.classify([makeText('t1', 0.5, 0.05)]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('Title / Header Note');
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].suggestedLabels).toContain('title');
  });

  it('classifies text in margin as Margin Note', async () => {
    const results = await provider.classify([makeText('t1', 0.05, 0.5)]);
    expect(results[0].category).toBe('Margin Note');
    expect(results[0].suggestedLabels).toContain('margin-note');
  });

  it('classifies text in body as Body Note', async () => {
    const results = await provider.classify([makeText('t1', 0.5, 0.5)]);
    expect(results[0].category).toBe('Body Note');
  });

  it('classifies rectangle as Area Markup', async () => {
    const results = await provider.classify([makeRect('r1', 0.3, 0.3)]);
    expect(results[0].category).toBe('Area Markup');
  });

  it('classifies arrow as Pointer', async () => {
    const results = await provider.classify([makeArrow('a1', 0.3, 0.3, 0.5, 0.5)]);
    expect(results[0].category).toBe('Pointer');
  });

  it('classifies measurement', async () => {
    const results = await provider.classify([makeMeasurement('m1')]);
    expect(results[0].category).toBe('Measurement');
  });

  it('classifies stamp', async () => {
    const results = await provider.classify([makeStamp('s1')]);
    expect(results[0].category).toBe('Stamp');
  });

  it('returns annotationId for each result', async () => {
    const results = await provider.classify([makeText('abc', 0.5, 0.5)]);
    expect(results[0].annotationId).toBe('abc');
  });

  it('handles empty input', async () => {
    const results = await provider.classify([]);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Local AI Provider - suggestGroups
// ---------------------------------------------------------------------------

describe('createLocalAIProvider — suggestGroups', () => {
  const provider = createLocalAIProvider();

  it('groups annotations by type', async () => {
    const annotations = [
      makeText('t1', 0.5, 0.5),
      makeText('t2', 0.1, 0.1),
      makeRect('r1', 0.3, 0.3),
    ];
    const groups = await provider.suggestGroups(annotations);
    const typeGroup = groups.find((g) => g.reason.includes('type: text'));
    expect(typeGroup).toBeDefined();
    expect(typeGroup!.annotationIds).toContain('t1');
    expect(typeGroup!.annotationIds).toContain('t2');
  });

  it('groups annotations by color', async () => {
    const a1 = makeRect('r1', 0.1, 0.1, '#ff0000');
    const a2 = makeRect('r2', 0.5, 0.5, '#ff0000');
    const groups = await provider.suggestGroups([a1, a2]);
    const colorGroup = groups.find((g) => g.reason.includes('color: #ff0000'));
    expect(colorGroup).toBeDefined();
    expect(colorGroup!.annotationIds).toHaveLength(2);
  });

  it('groups nearby annotations by proximity', async () => {
    const a1 = makeText('t1', 0.50, 0.50);
    const a2 = makeText('t2', 0.52, 0.52); // within 0.1 threshold
    const a3 = makeText('t3', 0.90, 0.90); // far away
    const groups = await provider.suggestGroups([a1, a2, a3]);
    const proxGroup = groups.find((g) => g.reason.includes('proximity'));
    expect(proxGroup).toBeDefined();
    expect(proxGroup!.annotationIds).toContain('t1');
    expect(proxGroup!.annotationIds).toContain('t2');
    expect(proxGroup!.annotationIds).not.toContain('t3');
  });

  it('does not create single-item groups', async () => {
    const groups = await provider.suggestGroups([makeText('t1', 0.5, 0.5)]);
    // Single annotation: no type group (need 2+), no color group, no proximity group
    expect(groups).toHaveLength(0);
  });

  it('handles empty input', async () => {
    const groups = await provider.suggestGroups([]);
    expect(groups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Local AI Provider - generateLabels
// ---------------------------------------------------------------------------

describe('createLocalAIProvider — generateLabels', () => {
  const provider = createLocalAIProvider();

  it('generates label from text content', async () => {
    const labels = await provider.generateLabels([makeText('t1', 0.5, 0.5, 'Check dimensions')]);
    expect(labels).toHaveLength(1);
    expect(labels[0].suggestedLabel).toBe('Check dimensions');
    expect(labels[0].basis).toContain('body');
  });

  it('truncates long text labels', async () => {
    const longText = 'A'.repeat(30);
    const labels = await provider.generateLabels([makeText('t1', 0.5, 0.5, longText)]);
    expect(labels[0].suggestedLabel.length).toBeLessThan(30);
    expect(labels[0].suggestedLabel).toContain('...');
  });

  it('labels measurement with unit', async () => {
    const labels = await provider.generateLabels([makeMeasurement('m1')]);
    expect(labels[0].suggestedLabel).toContain('ft');
  });

  it('labels stamp with its label', async () => {
    const labels = await provider.generateLabels([makeStamp('s1')]);
    expect(labels[0].suggestedLabel).toBe('APPROVED');
  });

  it('labels arrow with zone', async () => {
    const labels = await provider.generateLabels([makeArrow('a1', 0.5, 0.5, 0.6, 0.6)]);
    expect(labels[0].suggestedLabel).toContain('Arrow');
    expect(labels[0].suggestedLabel).toContain('body');
  });

  it('labels highlight with zone', async () => {
    const hl: Annotation = {
      id: 'h1', zIndex: 1, type: 'highlight',
      x: 0.05, y: 0.05, width: 0.1, height: 0.02, thickness: 0,
      color: '#ffff00', author: 'tester',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', locked: false,
    };
    const labels = await provider.generateLabels([hl]);
    expect(labels[0].suggestedLabel).toContain('Highlight');
  });

  it('returns annotationId for each label', async () => {
    const labels = await provider.generateLabels([makeText('xyz', 0.5, 0.5)]);
    expect(labels[0].annotationId).toBe('xyz');
  });

  it('handles empty input', async () => {
    const labels = await provider.generateLabels([]);
    expect(labels).toEqual([]);
  });
});
