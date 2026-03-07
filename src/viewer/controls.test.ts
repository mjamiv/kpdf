import { describe, expect, it } from 'vitest';
import {
  VIEWER_MAX_ZOOM,
  VIEWER_MIN_ZOOM,
  clampPage,
  clampZoom,
  stepZoom,
  zoomForFitPage,
  zoomForFitWidth,
} from './controls';

describe('viewer controls', () => {
  it('clamps zoom to bounds', () => {
    expect(clampZoom(-2)).toBe(VIEWER_MIN_ZOOM);
    expect(clampZoom(99)).toBe(VIEWER_MAX_ZOOM);
    expect(clampZoom(1.234)).toBe(1.234);
  });

  it('steps zoom with clamping', () => {
    expect(stepZoom(1, 0.1)).toBe(1.1);
    expect(stepZoom(VIEWER_MAX_ZOOM, 0.2)).toBe(VIEWER_MAX_ZOOM);
    expect(stepZoom(VIEWER_MIN_ZOOM, -0.2)).toBe(VIEWER_MIN_ZOOM);
  });

  it('clamps page jumps into valid page range', () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(4.6, 10)).toBe(5);
  });

  it('computes fit width zoom', () => {
    const zoom = zoomForFitWidth(1000, 1400);
    expect(zoom).toBeCloseTo(0.68, 2);
  });

  it('computes fit page zoom using tighter dimension', () => {
    const zoom = zoomForFitPage(1200, 800, 1000, 1400);
    expect(zoom).toBeCloseTo(0.54, 2);
  });
});
