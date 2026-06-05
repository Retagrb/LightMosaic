import { Container, Graphics } from 'pixi.js';
import { displayConfig } from '../config/displayConfig';
import { hashString } from '../util/random';
import { drawStarGlow, starTwinkleMul } from './starGlow';

export interface OrbitLight {
  graduateId: string;
  slotId: number;
  gfx: Graphics;
  phase: number;
  radius: number;
  twinkleSeed: number;
}

export class OrbitLights {
  readonly view = new Container();
  private lights: OrbitLight[] = [];
  private anchorResolver: ((slotId: number) => { x: number; y: number }) | null = null;

  setAnchorResolver(fn: (slotId: number) => { x: number; y: number }): void {
    this.anchorResolver = fn;
  }

  add(graduateId: string, slotId: number, color: number): void {
    if (this.lights.some((l) => l.graduateId === graduateId)) return;
    const g = new Graphics();
    const h = hashString(graduateId);
    drawStarGlow(g, color, { alpha: 1.28, seed: h });
    this.view.addChild(g);
    this.lights.push({
      graduateId,
      slotId,
      gfx: g,
      phase: ((h % 1000) / 1000) * Math.PI * 2,
      radius: displayConfig.orbitRadiusPx + (h % 20),
      twinkleSeed: h,
    });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const now = performance.now();
    for (const l of this.lights) {
      const anchor = this.anchorResolver?.(l.slotId) ?? { x: 0, y: 0 };
      l.phase += displayConfig.orbitSpeed * dt;
      l.gfx.position.set(
        anchor.x + Math.cos(l.phase) * l.radius,
        anchor.y + Math.sin(l.phase) * l.radius * 0.55,
      );
      l.gfx.alpha = starTwinkleMul(l.twinkleSeed, now);
    }
  }

  clear(): void {
    for (const l of this.lights) l.gfx.destroy();
    this.lights = [];
  }
}
