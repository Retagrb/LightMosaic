import { Container, Graphics } from 'pixi.js';
import { displayConfig } from '../config/displayConfig';
import { easeInOutCubic } from '../util/easing';
import { mixColor } from './starGlow';

export interface CometOptions {
  name: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  durationMs: number;
  embedStartFraction?: number;
  onEmbedStart: (x: number, y: number) => void;
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (x <= edge0) return 0;
  if (x >= edge1) return 1;
  const u = (x - edge0) / (edge1 - edge0);
  return u * u * (3 - 2 * u);
}

function cometFlightEase(t: number): number {
  return easeInOutCubic(t);
}

/** 视觉用缓动，变形更顺滑。 */
function morphVisual(m: number): number {
  return m * m * (3 - 2 * m);
}

export function cometMorphProgress(pathProgress: number): number {
  const start = displayConfig.cometMorphPathStart;
  const end = displayConfig.cometMorphPathEnd;
  return smoothstep(start, end, pathProgress);
}

function drawSoftSphere(g: Graphics, x: number, y: number, maxR: number, strength: number): void {
  const warm = 0xffc247;
  const cool = 0xffe59a;
  const white = 0xfff8dc;
  const layers = 12;
  for (let i = layers; i >= 0; i--) {
    const lt = i / layers;
    const r = maxR * (0.06 + lt * 0.94);
    const a = strength * Math.exp(-2.9 * lt * lt);
    const color = mixColor(white, lt < 0.38 ? warm : cool, Math.min(0.92, lt * 1.05));
    g.circle(x, y, r);
    g.fill({ color, alpha: a });
  }
  g.circle(x, y, maxR * 0.14);
  g.fill({ color: white, alpha: Math.min(1, strength * 1.05) });
}

export class CometName {
  private gfx: Graphics;
  private labelEl: HTMLDivElement;
  private history: TrailPoint[] = [];
  private elapsed = 0;
  private done = false;
  private destroyed = false;
  private embedStarted = false;
  private impactAtMs = 0;
  private lastTrailX = NaN;
  private lastTrailY = NaN;
  private readonly opts: CometOptions;
  private readonly displayName: string;
  private readonly trailFadeMs: number;

  constructor(
    opts: CometOptions,
    private readonly trailLayer: Container,
    labelHost: HTMLElement,
  ) {
    this.opts = opts;
    this.displayName = (opts.name ?? '').trim() || '?';
    this.trailFadeMs = displayConfig.cometTrailFadeMs;

    this.gfx = new Graphics();
    this.gfx.blendMode = 'add';
    this.trailLayer.addChild(this.gfx);

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'comet-name';
    this.labelEl.textContent = this.displayName;
    labelHost.appendChild(this.labelEl);

    this.setLabel(opts.fromX, opts.fromY, 0, 1, 0, false);
  }

  update(dtMs: number): boolean {
    if (this.destroyed || this.done) return false;
    this.elapsed += dtMs;

    const t = Math.min(1, this.elapsed / this.opts.durationMs);
    const path = cometFlightEase(t);
    const x = this.opts.fromX + (this.opts.toX - this.opts.fromX) * path;
    const y = this.opts.fromY + (this.opts.toY - this.opts.fromY) * path;

    const morph = cometMorphProgress(path);
    const mv = morphVisual(morph);
    const impactPath = this.opts.embedStartFraction ?? displayConfig.cometEmbedStartFraction;

    if (!this.embedStarted) {
      this.sampleTrailPoint(x, y, dtMs);

      const fadeInEnd = Math.min(0.08, 180 / this.opts.durationMs);
      const fadeIn = t < fadeInEnd ? t / fadeInEnd : 1;
      const nameMix = (1 - morph) ** 1.35;
      const nameAlpha = fadeIn * nameMix;
      const nameScale = 1 - mv * 0.52;

      this.setLabel(x, y, nameAlpha, nameScale, mv, mv > 0.06 && mv < 0.95);
      this.drawScene(x, y, morph, mv);
    } else {
      this.labelEl.style.opacity = '0';
      for (const h of this.history) h.age += dtMs;
      while (this.history.length > 0 && this.history[0]!.age > this.trailFadeMs) {
        this.history.shift();
      }
      this.drawImpactScene();
    }

    if (!this.embedStarted && path >= impactPath) {
      this.embedStarted = true;
      this.impactAtMs = this.elapsed;
      this.labelEl.style.opacity = '0';
      this.opts.onEmbedStart(this.opts.toX, this.opts.toY);
    }

    if (this.embedStarted) {
      if (this.elapsed - this.impactAtMs >= displayConfig.cometImpactDecayMs) {
        this.done = true;
        return false;
      }
      return true;
    }

    if (t >= 1) {
      this.done = true;
      return false;
    }
    return true;
  }

  private sampleTrailPoint(x: number, y: number, dtMs: number): void {
    for (const h of this.history) h.age += dtMs;
    while (this.history.length > 0 && this.history[0]!.age > this.trailFadeMs) {
      this.history.shift();
    }

    const minDist = displayConfig.cometTrailMinDistPx;
    const dx = x - this.lastTrailX;
    const dy = y - this.lastTrailY;
    const needPoint =
      this.history.length === 0 ||
      Number.isNaN(this.lastTrailX) ||
      dx * dx + dy * dy >= minDist * minDist;

    if (needPoint) {
      this.history.push({ x, y, age: 0 });
      this.lastTrailX = x;
      this.lastTrailY = y;
      if (this.history.length > displayConfig.cometTrailLength) this.history.shift();
    }
  }

  private setLabel(
    x: number,
    y: number,
    alpha: number,
    scale: number,
    morphV: number,
    morphing: boolean,
  ): void {
    this.labelEl.style.left = `${x}px`;
    this.labelEl.style.top = `${y}px`;
    this.labelEl.style.opacity = `${alpha}`;
    this.labelEl.style.letterSpacing = `${0.02 + morphV * 0.14}em`;
    this.labelEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
    this.labelEl.classList.toggle('comet-name--morph', morphing && alpha > 0.04);
    this.labelEl.style.setProperty('--comet-morph', `${morphV}`);
  }

  private drawScene(headX: number, headY: number, morph: number, mv: number): void {
    this.gfx.clear();
    this.drawTrail(headX, headY, morph, mv, 1);
    this.drawHead(headX, headY, morph, mv);
  }

  private drawHead(headX: number, headY: number, morph: number, mv: number): void {
    const nameGlow = (1 - mv) * 0.42;
    if (nameGlow > 0.02) {
      this.gfx.circle(headX, headY, 6 + (1 - mv) * 5);
      this.gfx.fill({ color: 0xffc247, alpha: nameGlow * 0.22 });
      this.gfx.circle(headX, headY, 2.5 + (1 - mv) * 2);
      this.gfx.fill({ color: 0xfff8dc, alpha: nameGlow * 0.85 });
    }

    const headR = 1.5 + mv * mv * 15;
    const strength = 0.06 + mv * 0.94;
    if (strength > 0.03) {
      drawSoftSphere(this.gfx, headX, headY, headR, strength);
    }

    if (mv > 0.25) {
      const corona = (mv - 0.25) / 0.75;
      this.gfx.circle(headX, headY, headR * (1.5 + corona * 0.6));
      this.gfx.stroke({
        width: 1.2 + corona * 0.8,
        color: mixColor(0xffb300, 0xfff0b8, corona),
        alpha: corona * 0.35 * strength,
      });
    }
  }

  /** 离子尾 → 暖核 → 头部亮桥，彗化后尾迹更亮更长。 */
  private drawTrail(
    headX: number,
    headY: number,
    morph: number,
    mv: number,
    globalFade: number,
  ): void {
    const n = this.history.length;
    if (n < 2) return;

    const tailBoost = 1 + mv * 0.85;

    this.gfx.moveTo(this.history[0]!.x, this.history[0]!.y);
    for (let i = 1; i < n; i++) {
      this.gfx.lineTo(this.history[i]!.x, this.history[i]!.y);
    }
    this.gfx.stroke({
      width: (3.5 + mv * 4) * tailBoost,
      color: 0x8a4b00,
      alpha: globalFade * 0.07 * tailBoost,
      cap: 'round',
      join: 'round',
    });

    for (let i = 1; i < n; i++) {
      const a = this.history[i]!;
      const b = this.history[i - 1]!;
      const life = 1 - a.age / this.trailFadeMs;
      if (life <= 0) continue;

      const segT = i / (n - 1);
      const taper = segT ** 2.65;
      const hot = taper * taper;
      const alpha = globalFade * life * (0.06 + taper * 0.42) * tailBoost;
      if (alpha < 0.004) continue;

      const ion = mixColor(0x8a4b00, 0xffb300, hot);
      const warm = mixColor(0xffb12b, 0xffe8a3, hot);
      const core = mixColor(0xffd24a, 0xfff8dc, hot);

      const wOuter = (0.2 + taper * 2.8) * tailBoost;
      const wMid = (0.15 + taper * 1.65) * tailBoost;
      const wCore = (0.1 + taper * 0.85) * tailBoost;

      this.strokeSeg(b, a, wOuter * 3.2, ion, alpha * 0.22);
      this.strokeSeg(b, a, wMid * 1.5, warm, alpha * 0.48);
      this.strokeSeg(b, a, wCore, core, alpha * 0.72);

      if (segT > 0.35 && i % 3 === 0) {
        const spark = alpha * (0.12 + hot * 0.2);
        const sr = 0.35 + taper * 1.1;
        this.gfx.circle(a.x, a.y, sr * 1.6);
        this.gfx.fill({ color: 0xffc247, alpha: spark * 0.4 });
        this.gfx.circle(a.x, a.y, sr);
        this.gfx.fill({ color: 0xfff0b8, alpha: spark });
      }
    }

    const tail = this.history[n - 1]!;
    const dx = headX - tail.x;
    const dy = headY - tail.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1.5) {
      const bridgeA = globalFade * (0.35 + mv * 0.45) * tailBoost;
      this.strokeSeg(tail, { x: headX, y: headY }, 2.2 + mv * 2.5, 0xffd24a, bridgeA * 0.35);
      this.strokeSeg(tail, { x: headX, y: headY }, 0.9 + mv * 1.2, 0xfff8dc, bridgeA * 0.75);
    }
  }

  private strokeSeg(
    b: { x: number; y: number },
    a: { x: number; y: number },
    width: number,
    color: number,
    alpha: number,
  ): void {
    this.gfx.moveTo(b.x, b.y);
    this.gfx.lineTo(a.x, a.y);
    this.gfx.stroke({ width, color, alpha, cap: 'round', join: 'round' });
  }

  private drawImpactScene(): void {
    const u = Math.min(1, (this.elapsed - this.impactAtMs) / displayConfig.cometImpactDecayMs);
    const fade = 1 - u * u;
    const { toX: cx, toY: cy } = this.opts;

    this.gfx.clear();
    this.drawTrail(cx, cy, 1, 1, fade * 0.7);

    const ringR = 12 + u * 64;
    this.gfx.circle(cx, cy, ringR);
    this.gfx.stroke({
      width: 2.5 - u * 1.5,
      color: 0xffc247,
      alpha: fade * 0.45,
    });
    this.gfx.circle(cx, cy, ringR * 0.4);
    this.gfx.stroke({ width: 1, color: 0xfff0b8, alpha: fade * 0.38 });
    drawSoftSphere(this.gfx, cx, cy, 10 + u * 24, fade * 0.8);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.labelEl.remove();
    this.gfx.parent?.removeChild(this.gfx);
    this.gfx.destroy();
  }
}

function hashUnit(seed: string, salt = ''): number {
  let h = 0;
  const s = seed + salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10000) / 10000;
}

/** Spread impact points so concurrent names do not stack on one label. */
export function pickCometTarget(
  w: number,
  h: number,
  graduateId: string,
): { x: number; y: number } {
  const cx = w / 2;
  const cy = h / 2 - 40;
  const spread = displayConfig.cometTargetSpreadPx;
  const angle = hashUnit(graduateId, 'a') * Math.PI * 2;
  const r = (0.28 + hashUnit(graduateId, 'r') * 0.72) * spread;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r * 0.82 };
}

export function randomEdgeSpawn(w: number, h: number): { x: number; y: number } {
  const edge = Math.floor(Math.random() * 4);
  const pad = Math.max(48, Math.min(w, h) * 0.06);
  switch (edge) {
    case 0:
      return { x: Math.random() * w, y: -pad };
    case 1:
      return { x: w + pad, y: Math.random() * h };
    case 2:
      return { x: Math.random() * w, y: h + pad };
    default:
      return { x: -pad, y: Math.random() * h };
  }
}
