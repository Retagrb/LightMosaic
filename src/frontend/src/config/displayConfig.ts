export const displayConfig = {
  expectedCount: 64,
  autoCompletePercent: 90,
  targetSlotCount: 1300,
  finalMaskSampleTarget: 5200,
  maskSampleStep: 2,
  alphaThreshold: 48,
  /** Graduate queue slots (released when a comet actually starts flying). */
  nameMaxConcurrent: 24,
  /** Max simultaneous name comets on screen. */ 
  cometMaxInFlight: 8,
  /**
   * Load scale for pipeline pressure (1 - e^(-load/s)).
   * Same curve for sparse and burst traffic; only the load value changes.
   */
  pipelineSaturation: 10,
  /** Comet launch gap (ms) at pressure 0 → 1. */
  cometStartGapMs: 360,
  cometStartGapBusyMs: 85,
  /** Radius (px) around center — each name lands on a different point. */
  cometTargetSpreadPx: 150,
  /** Name flight duration (ms) at pressure 0 → 1. */
  nameAnimationMs: 2000,
  nameAnimationBusyMs: 1100,
  /** 飞抵中心、光点散开（路径进度 0–1，非时间） */
  cometEmbedStartFraction: 0.97,
  /** 开始逐渐彗化（路径进度） */
  cometMorphPathStart: 0.22,
  /** 基本变为彗核（路径进度） */
  cometMorphPathEnd: 0.92,
  cometTrailLength: 72,
  cometTrailFadeMs: 2600,
  cometTrailMinDistPx: 3.5,
  /** Pixi impact ring duration after embed (ms). */
  cometImpactDecayMs: 380,
  finalSymbolMoveMs: 1800,
  finalExtraRevealMs: 1900,
  finalExtraStaggerMs: 1200,
  finalCharacterCutoffs: [0.318, 0.5024, 0.6754],
  /** Max random delay (ms) between light points from the same name. */
  embedStaggerMs: 110,
  /** Light fly-in from embed point (ms) at pressure 0 → 1. */
  embedFlyDurationMs: 620,
  embedFlyBusyMs: 500,
  showQr: true,
  showStats: true,
  pauseNameQueue: false,
  qrFadeOutOnCompleted: true,
  outerRingFraction: 0.2,
  symbolMaskUrl: 'masks/zhuo.png',
  finalMaskUrl: 'masks/zhuo-er-bu-fan.png',
  finalSubtitle: '长沙理工大学卓越工程师学院2026届毕业纪念',
  finalSubtitleColor: '#ffffff',
  /** Max height as fraction of screen (symbol). */
  symbolMaskMaxHeightFraction: 0.96,
  finalMaskMaxHeightFraction: 0.96,
  maskMaxWidthFraction: 0.96,
  /** Shift mask up from vertical center (QR is in bottom-right corner). */
  maskVerticalOffsetFraction: 0,
  orbitRadiusPx: 42,
  orbitSpeed: 0.35,
} as const;

export function triggerCount(): number {
  const { expectedCount, autoCompletePercent } = displayConfig;
  return Math.max(1, Math.ceil((expectedCount * autoCompletePercent) / 100));
}
