import { Container, Graphics } from 'pixi.js';
import type { LitSlot, MorphMapping, SlotPoint } from '../types/ceremony';
import { slotToScreen, type LayoutRect } from '../layout/stageLayout';
import { easeOutCubic } from '../util/easing';
import { drawStarGlow, starTwinkleMul } from './starGlow';

export interface GlyphParticle {
  slotId: number;
  gfx: Graphics;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  t: number;
  duration: number;
  color: number;
}

export class GlyphLights {
  readonly view = new Container();
  private dimLayer = new Graphics();
  private particles = new Map<number, GlyphParticle>();
  private points: SlotPoint[] = [];
  private layout: LayoutRect = { x: 0, y: 0, width: 100, height: 100 };
  private positionOverrides = new Map<number, { x: number; y: number }>();
  /** Maps 卓 slot id → final mask slot when displaying 卓尔不凡. */
  private morphByFromId = new Map<number, MorphMapping>();

  constructor() {
    this.view.addChild(this.dimLayer);
  }

  setMask(points: SlotPoint[], layout: LayoutRect, remapPositions = true): void {
    this.points = points;
    this.layout = layout;
    this.redrawDim();
    if (remapPositions) this.remapParticleTargets();
  }

  setMorphMappings(mappings: MorphMapping[]): void {
    this.morphByFromId = new Map(mappings.map((m) => [m.fromId, m]));
  }

  clearMorphMappings(): void {
    this.morphByFromId.clear();
  }

  /** Hide the dim mask outline (e.g. when morph begins). */
  hideDim(): void {
    this.dimLayer.clear();
  }

  private redrawDim(): void {
    this.dimLayer.clear();
    for (const p of this.points) {
      const { x, y } = slotToScreen(p, this.layout);
      this.dimLayer.circle(x, y, 2.2);
      this.dimLayer.fill({ color: 0x334455, alpha: 0.35 });
    }
  }

  private snapParticle(p: GlyphParticle, x: number, y: number): void {
    p.gfx.position.set(x, y);
    p.startX = x;
    p.startY = y;
    p.targetX = x;
    p.targetY = y;
    p.t = p.duration;
    p.gfx.alpha = 0.95;
  }

  getScreenPos(slotId: number): { x: number; y: number } {
    const override = this.positionOverrides.get(slotId);
    if (override) return override;

    const morph = this.morphByFromId.get(slotId);
    if (morph) {
      const finalSlot =
        this.points.find((s) => s.id === morph.toId) ??
        ({ id: morph.toId, nx: morph.toNx, ny: morph.toNy } satisfies SlotPoint);
      return slotToScreen(finalSlot, this.layout);
    }
    const p = this.points.find((s) => s.id === slotId);
    if (!p) return { x: this.layout.x + this.layout.width / 2, y: this.layout.y + this.layout.height / 2 };
    return slotToScreen(p, this.layout);
  }

  setLitImmediate(slots: LitSlot[]): void {
    for (const s of slots) {
      if (this.particles.has(s.slotId)) continue;
      const pos = this.getScreenPos(s.slotId);
      const g = new Graphics();
      drawStarGlow(g, s.color, { alpha: 1.28, seed: s.slotId });
      g.position.set(pos.x, pos.y);
      this.view.addChild(g);
      this.particles.set(s.slotId, {
        slotId: s.slotId,
        gfx: g,
        targetX: pos.x,
        targetY: pos.y,
        startX: pos.x,
        startY: pos.y,
        t: 1,
        duration: 1,
        color: s.color,
      });
    }
  }

  flyInFrom(
    slots: LitSlot[],
    originX: number,
    originY: number,
    maxStaggerMs: number,
    flyDurationMs = 580,
    delayForSlot?: (slot: LitSlot, target: { x: number; y: number }) => number,
  ): number {
    let maxDelay = 0;
    for (const s of slots) {
      const existing = this.particles.get(s.slotId);
      if (existing) {
        existing.gfx.destroy();
        this.particles.delete(s.slotId);
      }
      const target = this.getScreenPos(s.slotId);
      const delay = Math.max(
        0,
        Math.floor(
          delayForSlot?.(s, target) ?? Math.random() * maxStaggerMs,
        ),
      );
      maxDelay = Math.max(maxDelay, delay);
      const g = new Graphics();
      drawStarGlow(g, s.color, { alpha: 1.28, seed: s.slotId });
      g.position.set(originX, originY);
      this.view.addChild(g);
      this.particles.set(s.slotId, {
        slotId: s.slotId,
        gfx: g,
        targetX: target.x,
        targetY: target.y,
        startX: originX,
        startY: originY,
        t: -delay,
        duration: flyDurationMs,
        color: s.color,
      });
    }
    return flyDurationMs + maxDelay;
  }

  snapSlots(slotIds: number[]): void {
    for (const id of slotIds) {
      const p = this.particles.get(id);
      if (!p) continue;
      this.snapParticle(p, p.targetX, p.targetY);
    }
  }

  update(dtMs: number): void {
    const now = performance.now();
    for (const p of this.particles.values()) {
      p.t += dtMs;
      if (p.t < 0) {
        p.gfx.alpha = 0;
        continue;
      }
      const u = Math.min(1, Math.max(0, p.t / p.duration));
      const e = easeOutCubic(u);
      p.gfx.position.set(
        p.startX + (p.targetX - p.startX) * e,
        p.startY + (p.targetY - p.startY) * e,
      );
      const base = 0.58 + e * 0.42;
      p.gfx.alpha = base * starTwinkleMul(p.slotId, now);
    }
  }

  getParticlePositions(): Map<number, { x: number; y: number }> {
    const m = new Map<number, { x: number; y: number }>();
    for (const [id, p] of this.particles) {
      m.set(id, { x: p.gfx.position.x, y: p.gfx.position.y });
    }
    return m;
  }

  forEachParticle(fn: (slotId: number, x: number, y: number, particle: GlyphParticle) => void): void {
    for (const [id, p] of this.particles) {
      fn(id, p.gfx.position.x, p.gfx.position.y, p);
    }
  }

  /** Move gfx only (used during morph gather tween). */
  setParticlePosition(slotId: number, x: number, y: number): void {
    const p = this.particles.get(slotId);
    if (p) p.gfx.position.set(x, y);
  }

  snapParticleAt(slotId: number, x: number, y: number): void {
    const p = this.particles.get(slotId);
    if (p) this.snapParticle(p, x, y);
  }

  animateToPositions(
    positions: Map<number, { x: number; y: number }>,
    durationMs: number,
  ): void {
    this.positionOverrides = new Map(positions);
    this.hideDim();
    for (const [slotId, particle] of this.particles) {
      const target = positions.get(slotId);
      if (!target) continue;
      particle.startX = particle.gfx.position.x;
      particle.startY = particle.gfx.position.y;
      particle.targetX = target.x;
      particle.targetY = target.y;
      particle.t = 0;
      particle.duration = durationMs;
    }
  }

  setPositionOverrides(
    positions: Map<number, { x: number; y: number }>,
    remapPositions = true,
  ): void {
    this.positionOverrides = new Map(positions);
    if (remapPositions) this.remapParticleTargets();
  }

  clearPositionOverrides(): void {
    this.positionOverrides.clear();
  }

  beginScatter(offsets: Map<number, { dx: number; dy: number }>, durationMs: number): void {
    for (const [slotId, off] of offsets) {
      const p = this.particles.get(slotId);
      if (!p) continue;
      p.startX = p.gfx.position.x;
      p.startY = p.gfx.position.y;
      p.targetX = p.startX + off.dx;
      p.targetY = p.startY + off.dy;
      p.t = 0;
      p.duration = durationMs;
    }
  }

  getMaskPoints(): SlotPoint[] {
    return this.points;
  }

  setLayout(layout: LayoutRect, remapPositions = true): void {
    this.layout = layout;
    this.redrawDim();
    if (remapPositions) this.remapParticleTargets();
  }

  private remapParticleTargets(): void {
    for (const p of this.particles.values()) {
      const target = this.getScreenPos(p.slotId);
      if (this.isAnimating(p)) {
        p.targetX = target.x;
        p.targetY = target.y;
        continue;
      }
      this.snapParticle(p, target.x, target.y);
    }
  }

  /** Fly-in / morph tweens in progress — do not snap on resize. */
  private isAnimating(p: GlyphParticle): boolean {
    return p.t < p.duration;
  }

  clear(): void {
    for (const p of this.particles.values()) p.gfx.destroy();
    this.particles.clear();
    this.dimLayer.clear();
    this.positionOverrides.clear();
  }
}
