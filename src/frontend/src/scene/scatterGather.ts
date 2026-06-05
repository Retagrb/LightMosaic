import type { LitSlot } from '../types/ceremony';
import type { GlyphLights } from './glyphLights';

export type MorphPhase = 'idle' | 'move-symbol' | 'reveal-extra' | 'done';

export class MorphAnimator {
  phase: MorphPhase = 'idle';
  private elapsed = 0;
  private revealDurationMs = 0;
  private extraSlots: LitSlot[] = [];
  private revealOrigin = { x: 0, y: 0 };

  start(
    symbolTargets: Map<number, { x: number; y: number }>,
    extraSlots: LitSlot[],
    revealOrigin: { x: number; y: number },
    symbol: GlyphLights,
    moveDurationMs: number,
  ): void {
    this.phase = 'move-symbol';
    this.elapsed = 0;
    this.revealDurationMs = 0;
    this.extraSlots = extraSlots;
    this.revealOrigin = revealOrigin;
    symbol.animateToPositions(symbolTargets, moveDurationMs);
  }

  update(
    dtMs: number,
    symbol: GlyphLights,
    extras: GlyphLights,
    moveDurationMs: number,
    revealStaggerMs: number,
    revealFlyDurationMs: number,
  ): boolean {
    if (this.phase === 'idle' || this.phase === 'done') return false;

    this.elapsed += dtMs;
    symbol.update(dtMs);
    extras.update(dtMs);

    if (this.phase === 'move-symbol' && this.elapsed >= moveDurationMs) {
      this.phase = 'reveal-extra';
      this.elapsed = 0;
      const targetXs = this.extraSlots.map(
        (slot) => extras.getScreenPos(slot.slotId).x,
      );
      const minX = Math.min(...targetXs);
      const maxX = Math.max(...targetXs);
      const width = Math.max(1, maxX - minX);
      this.revealDurationMs = extras.flyInFrom(
        this.extraSlots,
        this.revealOrigin.x,
        this.revealOrigin.y,
        revealStaggerMs,
        revealFlyDurationMs,
        (_slot, target) => ((target.x - minX) / width) * revealStaggerMs,
      );
      return true;
    }

    if (
      this.phase === 'reveal-extra' &&
      this.elapsed >= this.revealDurationMs
    ) {
      this.phase = 'done';
      return false;
    }

    return true;
  }
}
