import type { CeremonySnapshot, GraduateJoinedPayload, LitSlot, SlotAssignment } from '../types/ceremony';
import { triggerCount } from '../config/displayConfig';
import { assignForGraduate, allSlotIds } from './slotAssigner';
import type { MaskTopology } from './slotAssigner';

export interface ReplayResult {
  assignments: Map<string, SlotAssignment>;
  litSlots: LitSlot[];
  usedSlotIds: Set<number>;
}

export function replayGraduates(
  snapshot: CeremonySnapshot,
  topology: MaskTopology,
): ReplayResult {
  const sorted = [...snapshot.recentGraduates].sort((a, b) => a.index - b.index);
  const usedSlotIds = new Set<number>();
  const assignments = new Map<string, SlotAssignment>();
  const litSlots: LitSlot[] = [];
  const postFinal =
    snapshot.stage === 'FinalTransform' || snapshot.stage === 'Completed';
  const trigger = triggerCount();

  for (const g of sorted) {
    const isOrbitOnly = postFinal && g.index > trigger;
    const assignStage = isOrbitOnly
      ? snapshot.stage
      : postFinal
        ? 'Collecting'
        : snapshot.stage;

    const assignment = assignForGraduate(
      g,
      snapshot.ceremonySeed,
      assignStage,
      topology.symbolSlots,
      usedSlotIds,
      topology.fillOrder,
      topology.outerRingIds,
    );
    assignments.set(g.id, assignment);

    if (isOrbitOnly) continue;

    for (const slotId of allSlotIds(assignment)) {
      usedSlotIds.add(slotId);
      litSlots.push({
        slotId,
        color: assignment.lightColor,
        graduateId: g.id,
        graduateName: g.name,
      });
    }
  }

  return { assignments, litSlots, usedSlotIds };
}

export function replayOne(
  payload: GraduateJoinedPayload,
  ceremonySeed: string,
  stage: CeremonySnapshot['stage'],
  topology: MaskTopology,
  usedSlotIds: Set<number>,
): { assignment: SlotAssignment; newLit: LitSlot[] } {
  const assignment = assignForGraduate(
    payload,
    ceremonySeed,
    stage,
    topology.symbolSlots,
    usedSlotIds,
    topology.fillOrder,
    topology.outerRingIds,
  );
  const newLit: LitSlot[] = [];
  if (!assignment.useOuterRing) {
    for (const slotId of allSlotIds(assignment)) {
      usedSlotIds.add(slotId);
      newLit.push({
        slotId,
        color: assignment.lightColor,
        graduateId: payload.id,
        graduateName: payload.name,
      });
    }
  }
  return { assignment, newLit };
}
