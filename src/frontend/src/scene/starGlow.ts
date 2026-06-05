import type { Graphics } from 'pixi.js';
import { mulberry32 } from '../util/random';

export interface StarGlowOptions {
  scale?: number;
  alpha?: number;
  seed?: number;
  /** Draw at screen position (for starfield); default origin. */
  at?: { x: number; y: number };
}

export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return (r << 16) | (g << 8) | bl;
}

/** Approximate radial Gaussian with many thin layers (no visible rings). */
function drawGaussianHalo(
  g: Graphics,
  ox: number,
  oy: number,
  maxR: number,
  layers: number,
  peakAlpha: number,
  tint: number,
  coreColor: number,
  stretch?: { rx: number; ry: number },
): void {
  for (let i = layers; i >= 0; i--) {
    const t = i / layers;
    const r = maxR * (0.06 + t * 0.94);
    const a = peakAlpha * Math.exp(-3.4 * t * t);
    const color = mixColor(coreColor, tint, Math.min(0.9, t * 1.15));
    if (stretch && t > 0.3) {
      g.ellipse(ox, oy, r * stretch.rx, r * stretch.ry);
    } else {
      g.circle(ox, oy, r);
    }
    g.fill({ color, alpha: a });
  }
}

/** Tapered flare: dots along axis, brightest near core (not hairline cross). */
function drawSoftFlare(
  g: Graphics,
  ox: number,
  oy: number,
  angle: number,
  len: number,
  alpha: number,
  color: number,
): void {
  const steps = 9;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const dist = len * t * t;
    const size = (1 - t) * 1.15 + 0.08;
    const a = alpha * (1 - t) ** 2.2;
    g.circle(ox + ca * dist, oy + sa * dist, size);
    g.fill({ color, alpha: a });
  }
}

/**
 * Natural golden star: smooth Gaussian halo with a warm core and rare soft flares.
 * Visual only — does not affect ceremony logic.
 */
export function drawStarGlow(g: Graphics, color: number, opts: StarGlowOptions = {}): void {
  const seed = opts.seed ?? 0x9e37;
  const rng = mulberry32(seed);
  const alphaMul = opts.alpha ?? 1;
  const ox = opts.at?.x ?? 0;
  const oy = opts.at?.y ?? 0;
  const sizeRoll = rng();
  const s = (opts.scale ?? 1.32) * (0.7 + sizeRoll * 0.36);

  const gold = 0xffd700;
  const tint = mixColor(color, gold, 0.82);
  const coreColor = 0xffffb8;

  g.clear();
  g.blendMode = 'add';

  const tier = sizeRoll < 0.52 ? 'dim' : sizeRoll < 0.86 ? 'mid' : 'bright';
  const maxR =
    tier === 'dim' ? 5.75 * s : tier === 'mid' ? 7.5 * s : 8.8 * s;
  const layers = tier === 'dim' ? 11 : tier === 'mid' ? 14 : 16;
  const peak =
    tier === 'dim'
      ? 0.135 * alphaMul
      : tier === 'mid'
        ? 0.118 * alphaMul
        : 0.108 * alphaMul;

  const stretch =
    rng() < 0.55
      ? { rx: 0.92 + rng() * 0.28, ry: 0.78 + rng() * 0.22 }
      : undefined;

  drawGaussianHalo(g, ox, oy, maxR, layers, peak, tint, coreColor, stretch);

  const coreR = (tier === 'dim' ? 0.76 : tier === 'mid' ? 0.7 : 0.72) * s;
  g.circle(ox, oy, coreR * 0.35);
  g.fill({ color: coreColor, alpha: 1.05 * alphaMul });
  g.circle(ox, oy, coreR * 0.12);
  g.fill({ color: 0xffffe0, alpha: 1.08 * alphaMul });

  if (tier === 'bright' && rng() < 0.38) {
    const flareA = rng() * Math.PI;
    const len1 = (3.8 + rng() * 4.8) * s;
    const len2 = len1 * (0.45 + rng() * 0.35);
    const flareAlpha = 0.12 * alphaMul;
    drawSoftFlare(g, ox, oy, flareA, len1, flareAlpha, mixColor(tint, coreColor, 0.6));
    drawSoftFlare(g, ox, oy, flareA + Math.PI / 2, len2, flareAlpha * 0.75, mixColor(tint, coreColor, 0.45));
  }
}

/** Subtle galaxy twinkle; phase derived from seed only. */
export function starTwinkleMul(seed: number, timeMs: number): number {
  const a = (seed % 997) * 0.011;
  const b = (seed % 503) * 0.019;
  const w = 0.0016 + (seed % 7) * 0.00035;
  return 0.94 + 0.06 * Math.sin(timeMs * w + a) * Math.sin(timeMs * w * 1.37 + b);
}
