export type CeremonyStage =
  | 'Idle'
  | 'Collecting'
  | 'FinalTransform'
  | 'Completed';

export type JoinSource = 'Mobile' | 'Simulator';

export interface GraduateJoinedPayload {
  id: string;
  name: string;
  index: number;
  timestamp: number;
  source: JoinSource;
}

export interface CeremonySnapshot {
  stage: CeremonyStage;
  litCount: number;
  joinUrl: string;
  ceremonySeed: string;
  version: number;
  recentGraduates: GraduateJoinedPayload[];
}

export interface SlotPoint {
  id: number;
  nx: number;
  ny: number;
}

export interface MorphMapping {
  fromId: number;
  toId: number;
  toNx: number;
  toNy: number;
}

export interface SlotAssignment {
  mainSlotId: number;
  spreadSlotIds: number[];
  useOuterRing: boolean;
  lightColor: number;
}

export interface LitSlot {
  slotId: number;
  color: number;
  graduateId: string;
  graduateName: string;
}
