export const VIEWER_MIN_ZOOM = 0.1;
export const VIEWER_MAX_ZOOM = 8;
export const VIEWER_ZOOM_STEP = 0.1;
export const VIEWER_FRAME_PADDING = 48;

export function clampZoom(zoom: number, min = VIEWER_MIN_ZOOM, max = VIEWER_MAX_ZOOM): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(min, Math.min(max, Math.round(zoom * 10000) / 10000));
}

export function stepZoom(current: number, delta: number, min = VIEWER_MIN_ZOOM, max = VIEWER_MAX_ZOOM): number {
  return clampZoom(current + delta, min, max);
}

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page) || pageCount <= 0) return 1;
  const rounded = Math.round(page);
  return Math.max(1, Math.min(pageCount, rounded));
}

export function zoomForFitWidth(
  shellWidth: number,
  pageBaseWidth: number,
  padding = VIEWER_FRAME_PADDING,
): number {
  if (shellWidth <= 0 || pageBaseWidth <= 0) return 1;
  return clampZoom((shellWidth - padding) / pageBaseWidth);
}

export function zoomForFitPage(
  shellWidth: number,
  shellHeight: number,
  pageBaseWidth: number,
  pageBaseHeight: number,
  padding = VIEWER_FRAME_PADDING,
): number {
  if (shellWidth <= 0 || shellHeight <= 0 || pageBaseWidth <= 0 || pageBaseHeight <= 0) return 1;
  const widthFit = (shellWidth - padding) / pageBaseWidth;
  const heightFit = (shellHeight - padding) / pageBaseHeight;
  return clampZoom(Math.min(widthFit, heightFit));
}
