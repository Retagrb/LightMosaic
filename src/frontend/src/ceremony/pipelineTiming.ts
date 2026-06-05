import { displayConfig } from '../config/displayConfig';

export interface PipelineLoad {
  queuePending: number;
  cometsWaiting: number;
  cometsInFlight: number;
  embedsInFlight: number;
}

export interface CometPipelineTiming {
  pressure: number;
  launchGapMs: number;
  cometDurationMs: number;
  embedFlyDurationMs: number;
}

/** Raw load before saturation — same formula at any arrival rate. */
export function measurePipelineLoad(load: PipelineLoad): number {
  return (
    load.queuePending +
    load.cometsWaiting +
    load.cometsInFlight * 1.05 +
    load.embedsInFlight * 0.35
  );
}

/** 0 = calm, →1 as load grows; smooth, no thresholds. */
export function pipelinePressure01(rawLoad: number): number {
  const s = displayConfig.pipelineSaturation;
  if (rawLoad <= 0 || s <= 0) return 0;
  return 1 - Math.exp(-rawLoad / s);
}

function lerp(calm: number, busy: number, pressure: number): number {
  return calm + (busy - calm) * pressure;
}

/** All ceremony timings for the current load — one curve, no mode switch. */
export function cometPipelineTiming(load: PipelineLoad): CometPipelineTiming {
  const pressure = pipelinePressure01(measurePipelineLoad(load));
  const c = displayConfig;
  return {
    pressure,
    launchGapMs: Math.round(lerp(c.cometStartGapMs, c.cometStartGapBusyMs, pressure)),
    cometDurationMs: Math.round(lerp(c.nameAnimationMs, c.nameAnimationBusyMs, pressure)),
    embedFlyDurationMs: Math.round(lerp(c.embedFlyDurationMs, c.embedFlyBusyMs, pressure)),
  };
}
