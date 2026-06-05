import { displayConfig } from '../config/displayConfig';
import type { SlotPoint } from '../types/ceremony';
import { mulberry32 } from '../util/random';

export interface MaskSample {
  points: SlotPoint[];
  pixelWidth: number;
  pixelHeight: number;
}

function isMaskPixel(r: number, g: number, b: number, a: number, alphaThreshold: number): boolean {
  if (a < alphaThreshold) return false;
  const lum = (r + g + b) / 3;
  return lum <= 130 || lum >= 175;
}

function assignIds(points: { nx: number; ny: number }[], seed: number): SlotPoint[] {
  const rng = mulberry32(seed);
  const shuffled = [...points].sort(() => rng() - 0.5);
  return shuffled.map((p, i) => ({ id: i, nx: p.nx, ny: p.ny }));
}

function subsample(points: { nx: number; ny: number }[], target: number, seed: number): { nx: number; ny: number }[] {
  if (points.length <= target) return points;
  const rng = mulberry32(seed + 1);
  const copy = [...points];
  const result: { nx: number; ny: number }[] = [];
  while (result.length < target && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    result.push(copy.splice(i, 1)[0]!);
  }
  return result;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load mask: ${url}`));
    const base = import.meta.env.BASE_URL;
    img.src = url.startsWith('http') ? url : `${base}${url.replace(/^\//, '')}`;
  });
}

function sampleFromImage(
  img: HTMLImageElement,
  step: number,
  alphaThreshold: number,
  target: number,
  seed: number,
): MaskSample {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const raw: { nx: number; ny: number }[] = [];
  const s = Math.max(1, step);

  for (let y = 0; y < img.height; y += s) {
    for (let x = 0; x < img.width; x += s) {
      const i = (y * img.width + x) * 4;
      if (isMaskPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!, alphaThreshold)) {
        raw.push({ nx: x / img.width, ny: y / img.height });
      }
    }
  }

  if (raw.length === 0) throw new Error('No mask pixels');

  let pts = raw;
  if (pts.length > target) pts = subsample(pts, target, seed);
  else if (pts.length < target * 0.5) {
    // retry with smaller step would need re-scan; accept count
  }

  return {
    points: assignIds(pts, seed),
    pixelWidth: img.width,
    pixelHeight: img.height,
  };
}

function rasterizeStrokes(
  strokes: [number, number, number, number][],
  step: number,
  pixelWidth: number,
  pixelHeight: number,
  seed: number,
): MaskSample {
  const set = new Set<string>();
  for (const [x1, y1, x2, y2] of strokes) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.floor(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const nx = x1 + (x2 - x1) * t;
      const ny = y1 + (y2 - y1) * t;
      set.add(`${Math.round(nx * 1000)},${Math.round(ny * 1000)}`);
    }
  }
  const points = [...set].map((k) => {
    const [sx, sy] = k.split(',').map(Number);
    return { nx: sx! / 1000, ny: sy! / 1000 };
  });
  return {
    points: assignIds(points, seed),
    pixelWidth,
    pixelHeight,
  };
}

function placeholderSymbol(seed: number): MaskSample {
  return rasterizeStrokes(
    [
      [0.38, 0.18, 0.62, 0.18],
      [0.5, 0.18, 0.5, 0.82],
      [0.32, 0.42, 0.68, 0.42],
      [0.36, 0.68, 0.64, 0.68],
    ],
    0.02,
    800,
    1000,
    seed,
  );
}

function placeholderFinal(seed: number): MaskSample {
  return rasterizeStrokes(
    [
      [0.08, 0.22, 0.22, 0.22],
      [0.15, 0.22, 0.15, 0.78],
      [0.28, 0.22, 0.42, 0.22],
      [0.35, 0.22, 0.35, 0.78],
      [0.48, 0.22, 0.62, 0.22],
      [0.55, 0.22, 0.55, 0.78],
      [0.68, 0.3, 0.92, 0.3],
      [0.8, 0.3, 0.8, 0.72],
    ],
    0.018,
    2400,
    800,
    seed,
  );
}

export async function sampleMask(
  url: string,
  seed: number,
  isFinal = false,
  targetOverride?: number,
): Promise<MaskSample> {
  const { maskSampleStep, alphaThreshold } = displayConfig;
  const targetSlotCount = targetOverride ?? displayConfig.targetSlotCount;
  try {
    const img = await loadImage(url);
    let step = maskSampleStep;
    let sample = sampleFromImage(img, step, alphaThreshold, targetSlotCount, seed);
    while (sample.points.length > targetSlotCount * 1.2 && step < 32) {
      step += 2;
      sample = sampleFromImage(img, step, alphaThreshold, targetSlotCount, seed);
    }
    if (sample.points.length > targetSlotCount) {
      const raw = sample.points.map((p) => ({ nx: p.nx, ny: p.ny }));
      const reduced = subsample(raw, targetSlotCount, seed);
      sample = {
        ...sample,
        points: assignIds(reduced, seed),
      };
    }
    return sample;
  } catch {
    return isFinal ? placeholderFinal(seed) : placeholderSymbol(seed);
  }
}
