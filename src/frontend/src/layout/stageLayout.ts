import type { SlotPoint } from '../types/ceremony';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fit a mask image on stage using true pixel aspect ratio (not sampled-point bbox). */
export function fitMaskLayout(
  screenW: number,
  screenH: number,
  maxHeightFraction: number,
  pixelWidth: number,
  pixelHeight: number,
  maxWidthFraction: number,
  verticalOffsetFraction: number,
): LayoutRect {
  const aspect = pixelWidth / Math.max(1, pixelHeight);
  const maxH = screenH * maxHeightFraction;
  const maxW = screenW * maxWidthFraction;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }

  return {
    x: (screenW - w) / 2,
    y: (screenH - h) / 2 - screenH * verticalOffsetFraction,
    width: w,
    height: h,
  };
}

/** Map normalized mask coordinates (0–1 of image) to screen space. */
export function slotToScreen(slot: SlotPoint, layout: LayoutRect): { x: number; y: number } {
  return {
    x: layout.x + slot.nx * layout.width,
    y: layout.y + slot.ny * layout.height,
  };
}
