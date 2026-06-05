import { displayConfig, triggerCount } from '../config/displayConfig';
import { slotCountForGraduate } from '../mask/fillCurve';
import type { CeremonyStage, GraduateJoinedPayload, SlotAssignment, SlotPoint } from '../types/ceremony';
import { pickColor } from './colorPalette';
import { mulberry32, seededRng } from '../util/random';

export interface MaskTopology {
  symbolSlots: SlotPoint[];
  finalSlots: SlotPoint[];
  fillOrder: number[];
  outerRingIds: number[];
}

export function buildTopology(symbolSlots: SlotPoint[], ceremonySeed: string): MaskTopology {
  const rng = mulberry32(
    symbolSlots.reduce((a, s) => a + s.id, 0) ^ ceremonySeed.split('').reduce((a, c) => a + c.charCodeAt(0), 0),
  );
  const fillOrder = [...symbolSlots].sort(() => rng() - 0.5).map((s) => s.id);
  const outerCount = Math.max(1, Math.floor(fillOrder.length * displayConfig.outerRingFraction));
  const outerRingIds = fillOrder.slice(-outerCount);
  return { symbolSlots, finalSlots: [], fillOrder, outerRingIds };
}

function pickRandomIds(
  rng: () => number,
  available: number[],
  count: number,
): number[] {
  const pool = [...available];
  const picked: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

export function assignForGraduate(
  payload: GraduateJoinedPayload,
  ceremonySeed: string,
  stage: CeremonyStage,
  symbolSlots: SlotPoint[],
  usedSlotIds: Set<number>,
  fillOrder: number[],
  outerRingIds: number[],
): SlotAssignment {
  const color = pickColor(ceremonySeed, payload.id);
  const rng = seededRng(ceremonySeed, payload.id);
  const trigger = triggerCount();
  const useOuter =
    stage === 'FinalTransform' || stage === 'Completed';

  if (useOuter) {
    const pool = outerRingIds.length > 0 ? outerRingIds : fillOrder;
    const idx = Math.floor(rng() * pool.length);
    const mainId = pool[idx % pool.length]!;
    return { mainSlotId: mainId, spreadSlotIds: [], useOuterRing: true, lightColor: color };
  }

  let want = slotCountForGraduate(payload.index, trigger, symbolSlots.length);
  if (payload.index >= trigger) {
    const remaining = symbolSlots.filter((s) => !usedSlotIds.has(s.id)).length;
    want = Math.max(want, remaining);
  }

  const available = symbolSlots.map((s) => s.id).filter((id) => !usedSlotIds.has(id));
  const ids = pickRandomIds(rng, available, want);
  const mainId = ids[0] ?? fillOrder.find((id) => !usedSlotIds.has(id)) ?? fillOrder[0] ?? 0;
  const spread = ids.length > 0 ? ids.slice(1) : [];
  const reserved = ids.length > 0 ? ids : usedSlotIds.has(mainId) ? [] : [mainId];
  for (const id of reserved) usedSlotIds.add(id);

  return { mainSlotId: mainId, spreadSlotIds: spread, useOuterRing: false, lightColor: color };
}

export function allSlotIds(assignment: SlotAssignment): number[] {
  return [assignment.mainSlotId, ...assignment.spreadSlotIds];
}
