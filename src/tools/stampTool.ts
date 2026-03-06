import type { ToolBehavior, ToolContext, NormalizedPointerEvent } from './registry';
import { registerTool } from './registry';
import { getAllStamps, type StampDef } from '../workflow/stamps';

let activeStamp: StampDef = getAllStamps()[0];

export function getActiveStamp(): StampDef { return activeStamp; }
export function setActiveStamp(stamp: StampDef) { activeStamp = stamp; }

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(url: string): HTMLImageElement | null {
  if (imageCache.has(url)) return imageCache.get(url)!;
  const img = new Image();
  img.src = url;
  img.onload = () => { imageCache.set(url, img); };
  img.onerror = () => { /* ignore invalid images */ };
  // Start loading but don't return until cached
  if (img.complete && img.naturalWidth > 0) {
    imageCache.set(url, img);
    return img;
  }
  return null;
}

// Pre-load an image stamp so it's ready when placed
export function preloadStampImage(url: string): void {
  if (!imageCache.has(url)) {
    const img = new Image();
    img.src = url;
    img.onload = () => { imageCache.set(url, img); };
  }
}

const stampTool: ToolBehavior = {
  name: 'stamp',
  label: 'Stamp',
  cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235b5fc7' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M5 22h14M5 18h14v4H5zM7 18l-1-4h12l-1 4M12 14V8M8 8h8l-2-4H10z'/%3E%3C/svg%3E") 12 22, crosshair`,

  onPointerDown(ctx: ToolContext, e: NormalizedPointerEvent) {
    const stamp = activeStamp;
    const timestamp = new Date().toISOString();
    ctx.dispatch({
      type: 'ADD_ANNOTATION',
      page: ctx.page,
      annotation: {
        id: ctx.randomId(),
        zIndex: ctx.nextZIndex(),
        color: stamp.color,
        author: ctx.author,
        createdAt: timestamp,
        updatedAt: timestamp,
        locked: false,
        type: 'stamp',
        x: e.point.x - stamp.defaultWidth / 2,
        y: e.point.y - stamp.defaultHeight / 2,
        width: stamp.defaultWidth,
        height: stamp.defaultHeight,
        stampId: stamp.id,
        label: stamp.label,
        imageUrl: stamp.imageUrl,
      },
    });
  },

  onPointerMove(_ctx: ToolContext, _e: NormalizedPointerEvent) {},
  onPointerUp(_ctx: ToolContext, _e: NormalizedPointerEvent) {},
};

registerTool(stampTool);
export default stampTool;
