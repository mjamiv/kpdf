/**
 * Pixel-diff engine for document comparison.
 *
 * Compares two ImageData objects (from canvas rendering of PDF pages) and produces:
 * - A diff image where removed pixels are red and added pixels are green
 * - Detected diff regions (bounding boxes of contiguous changed areas)
 * - Overall diff statistics
 */

export type DiffRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiffResult = {
  /** Total number of pixels that differ */
  diffPixelCount: number;
  /** Percentage of pixels that differ (0-100) */
  diffPercentage: number;
  /** Bounding boxes of contiguous diff regions */
  diffRegions: DiffRegion[];
  /** RGBA image data showing the diff overlay */
  diffImageData: ImageData;
};

/**
 * Color distance threshold for considering two pixels "different".
 * Using Euclidean distance in RGB space; threshold of 30 handles
 * anti-aliasing and minor rendering differences.
 */
const COLOR_THRESHOLD = 30;

/**
 * Minimum region size (in pixels) to report as a diff region.
 * Filters out single-pixel noise.
 */
const MIN_REGION_SIZE = 4;

/**
 * Grid cell size for region detection. Diff pixels are grouped into cells,
 * then adjacent cells are merged into regions.
 */
const CELL_SIZE = 16;

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Compute pixel-level difference between two images.
 *
 * Both images must have the same dimensions. If dimensions differ, the function
 * uses the smaller dimensions and treats extra pixels as differences.
 *
 * @param img1 - "Original" image data
 * @param img2 - "Revised" image data
 * @returns DiffResult with statistics, regions, and a visual diff image
 */
export function computePixelDiff(img1: ImageData, img2: ImageData): DiffResult {
  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);
  const minW = Math.min(img1.width, img2.width);
  const minH = Math.min(img1.height, img2.height);

  // Create diff image: start with transparent
  const diffData = new Uint8ClampedArray(width * height * 4);

  let diffPixelCount = 0;

  // Grid for region detection
  const gridW = Math.ceil(width / CELL_SIZE);
  const gridH = Math.ceil(height / CELL_SIZE);
  const grid = new Uint8Array(gridW * gridH);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;

      // If outside one of the images, it's a difference
      if (x >= minW || y >= minH) {
        diffPixelCount++;
        // Green for pixels only in img2 (added), red for only in img1 (removed)
        if (x < img2.width && y < img2.height) {
          diffData[outIdx] = 0;
          diffData[outIdx + 1] = 200;
          diffData[outIdx + 2] = 0;
        } else {
          diffData[outIdx] = 200;
          diffData[outIdx + 1] = 0;
          diffData[outIdx + 2] = 0;
        }
        diffData[outIdx + 3] = 180;
        grid[Math.floor(y / CELL_SIZE) * gridW + Math.floor(x / CELL_SIZE)] = 1;
        continue;
      }

      const idx1 = (y * img1.width + x) * 4;
      const idx2 = (y * img2.width + x) * 4;

      const r1 = img1.data[idx1];
      const g1 = img1.data[idx1 + 1];
      const b1 = img1.data[idx1 + 2];
      const r2 = img2.data[idx2];
      const g2 = img2.data[idx2 + 1];
      const b2 = img2.data[idx2 + 2];

      const dist = colorDistance(r1, g1, b1, r2, g2, b2);

      if (dist > COLOR_THRESHOLD) {
        diffPixelCount++;

        // Determine if this is more "removed" (brighter in img1) or "added" (brighter in img2)
        const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

        if (lum1 > lum2) {
          // Darker in new = something added (drawn)
          diffData[outIdx] = 0;
          diffData[outIdx + 1] = 180;
          diffData[outIdx + 2] = 0;
        } else {
          // Lighter in new = something removed
          diffData[outIdx] = 220;
          diffData[outIdx + 1] = 0;
          diffData[outIdx + 2] = 0;
        }
        diffData[outIdx + 3] = 160;

        grid[Math.floor(y / CELL_SIZE) * gridW + Math.floor(x / CELL_SIZE)] = 1;
      } else {
        // No difference — transparent
        diffData[outIdx + 3] = 0;
      }
    }
  }

  // Extract regions from grid using connected-component labeling
  const diffRegions = extractRegions(grid, gridW, gridH);

  const totalPixels = width * height;
  const diffPercentage = totalPixels > 0 ? (diffPixelCount / totalPixels) * 100 : 0;

  return {
    diffPixelCount,
    diffPercentage,
    diffRegions,
    diffImageData: new ImageData(diffData, width, height),
  };
}

/**
 * Simple connected-component labeling on a boolean grid to extract diff regions.
 */
function extractRegions(grid: Uint8Array, gridW: number, gridH: number): DiffRegion[] {
  const visited = new Uint8Array(gridW * gridH);
  const regions: DiffRegion[] = [];

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      if (grid[idx] === 0 || visited[idx]) continue;

      // BFS flood fill
      let minX = gx;
      let minY = gy;
      let maxX = gx;
      let maxY = gy;
      const queue = [idx];
      visited[idx] = 1;

      while (queue.length > 0) {
        const cur = queue.pop()!;
        const cy = Math.floor(cur / gridW);
        const cx = cur % gridW;

        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);

        // 4-connected neighbors
        const neighbors = [
          cy > 0 ? (cy - 1) * gridW + cx : -1,
          cy < gridH - 1 ? (cy + 1) * gridW + cx : -1,
          cx > 0 ? cy * gridW + (cx - 1) : -1,
          cx < gridW - 1 ? cy * gridW + (cx + 1) : -1,
        ];

        for (const ni of neighbors) {
          if (ni >= 0 && grid[ni] === 1 && !visited[ni]) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      // Convert grid coords back to pixel coords
      const rx = minX * CELL_SIZE;
      const ry = minY * CELL_SIZE;
      const rw = (maxX - minX + 1) * CELL_SIZE;
      const rh = (maxY - minY + 1) * CELL_SIZE;

      if (rw >= MIN_REGION_SIZE && rh >= MIN_REGION_SIZE) {
        regions.push({ x: rx, y: ry, width: rw, height: rh });
      }
    }
  }

  return regions;
}
