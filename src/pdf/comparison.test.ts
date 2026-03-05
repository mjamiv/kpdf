import { describe, it, expect, beforeAll } from 'vitest';
import { computePixelDiff } from './comparison';

// Polyfill ImageData for Node.js test environment
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height?: number) {
        this.data = data;
        this.width = width;
        this.height = height ?? (data.length / 4 / width);
      }
    };
  }
});

function makeImageData(width: number, height: number, fill: [number, number, number, number] = [255, 255, 255, 255]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return new ImageData(data, width, height);
}

function setPixel(img: ImageData, x: number, y: number, r: number, g: number, b: number): void {
  const idx = (y * img.width + x) * 4;
  img.data[idx] = r;
  img.data[idx + 1] = g;
  img.data[idx + 2] = b;
  img.data[idx + 3] = 255;
}

describe('computePixelDiff', () => {
  it('returns zero diff for identical images', () => {
    const img1 = makeImageData(100, 100);
    const img2 = makeImageData(100, 100);
    const result = computePixelDiff(img1, img2);
    expect(result.diffPixelCount).toBe(0);
    expect(result.diffPercentage).toBe(0);
    expect(result.diffRegions).toEqual([]);
  });

  it('detects differences between images', () => {
    const img1 = makeImageData(100, 100);
    const img2 = makeImageData(100, 100);

    // Draw a large block of different pixels
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        setPixel(img2, x, y, 0, 0, 0);
      }
    }

    const result = computePixelDiff(img1, img2);
    expect(result.diffPixelCount).toBeGreaterThan(0);
    expect(result.diffPercentage).toBeGreaterThan(0);
    expect(result.diffRegions.length).toBeGreaterThan(0);
  });

  it('produces a diff image of the correct size', () => {
    const img1 = makeImageData(50, 50);
    const img2 = makeImageData(50, 50);
    const result = computePixelDiff(img1, img2);
    expect(result.diffImageData.width).toBe(50);
    expect(result.diffImageData.height).toBe(50);
  });

  it('handles images of different sizes', () => {
    const img1 = makeImageData(100, 100);
    const img2 = makeImageData(120, 110);

    const result = computePixelDiff(img1, img2);
    // Extra pixels should be counted as differences
    expect(result.diffPixelCount).toBeGreaterThan(0);
    expect(result.diffImageData.width).toBe(120);
    expect(result.diffImageData.height).toBe(110);
  });

  it('ignores minor color differences below threshold', () => {
    const img1 = makeImageData(50, 50, [200, 200, 200, 255]);
    const img2 = makeImageData(50, 50, [202, 200, 200, 255]); // Very slight difference

    const result = computePixelDiff(img1, img2);
    expect(result.diffPixelCount).toBe(0);
  });

  it('diff percentage is between 0 and 100', () => {
    const img1 = makeImageData(50, 50, [0, 0, 0, 255]);
    const img2 = makeImageData(50, 50, [255, 255, 255, 255]);

    const result = computePixelDiff(img1, img2);
    expect(result.diffPercentage).toBeGreaterThan(0);
    expect(result.diffPercentage).toBeLessThanOrEqual(100);
  });

  it('detects contiguous regions', () => {
    const img1 = makeImageData(100, 100);
    const img2 = makeImageData(100, 100);

    // Create two separate blocks of changes
    for (let y = 5; y < 25; y++) {
      for (let x = 5; x < 25; x++) {
        setPixel(img2, x, y, 0, 0, 0);
      }
    }
    for (let y = 60; y < 80; y++) {
      for (let x = 60; x < 80; x++) {
        setPixel(img2, x, y, 0, 0, 0);
      }
    }

    const result = computePixelDiff(img1, img2);
    expect(result.diffRegions.length).toBe(2);
  });

  it('diff regions have valid bounding box properties', () => {
    const img1 = makeImageData(100, 100);
    const img2 = makeImageData(100, 100);

    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        setPixel(img2, x, y, 0, 0, 0);
      }
    }

    const result = computePixelDiff(img1, img2);
    for (const region of result.diffRegions) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.width).toBeGreaterThan(0);
      expect(region.height).toBeGreaterThan(0);
    }
  });
});
