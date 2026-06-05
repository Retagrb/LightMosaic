import { Container, Graphics } from 'pixi.js';
import { mulberry32 } from '../util/random';
import { drawStarGlow } from './starGlow';

export class Starfield {
  readonly view = new Container();
  private gfx = new Graphics();

  constructor(seed = 42) {
    this.view.addChild(this.gfx);
    const rng = mulberry32(seed);
    for (let i = 0; i < 200; i++) {
      const x = rng() * 2000;
      const y = rng() * 1200;
      const roll = rng();
      const tint = roll < 0.72 ? 0xe8f0ff : 0xfff4e8;
      const scale = roll < 0.78 ? 0.31 + rng() * 0.14 : 0.27 + rng() * 0.15;
      const a = 0.35 + rng() * 0.55;

      const star = new Graphics();
      drawStarGlow(star, tint, {
        seed: (seed + i * 7919) >>> 0,
        alpha: a * (roll < 0.78 ? 0.52 : 0.72),
        scale,
        at: { x, y },
      });
      this.gfx.addChild(star);
    }
  }

  resize(w: number, h: number): void {
    const sx = w / 2000;
    const sy = h / 1200;
    this.view.scale.set(sx, sy);
  }
}
