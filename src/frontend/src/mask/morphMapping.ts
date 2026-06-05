import type { MorphMapping, SlotPoint } from '../types/ceremony';

interface Bbox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function bboxOf(points: SlotPoint[]): Bbox {
  const minX = Math.min(...points.map((p) => p.nx));
  const maxX = Math.max(...points.map((p) => p.nx));
  const minY = Math.min(...points.map((p) => p.ny));
  const maxY = Math.max(...points.map((p) => p.ny));
  return {
    minX,
    minY,
    width: Math.max(0.02, maxX - minX),
    height: Math.max(0.02, maxY - minY),
  };
}

function relUV(p: SlotPoint, box: Bbox): { u: number; v: number } {
  return {
    u: (p.nx - box.minX) / box.width,
    v: (p.ny - box.minY) / box.height,
  };
}

export function buildMorphMappings(symbol: SlotPoint[], finalSlots: SlotPoint[]): MorphMapping[] {
  if (symbol.length === 0 || finalSlots.length === 0) return [];

  const zBox = bboxOf(symbol);
  const fBox = bboxOf(finalSlots);
  const usedFinal = new Set<number>();
  const mappings: MorphMapping[] = [];

  const sorted = [...symbol].sort((a, b) => a.ny - b.ny || a.nx - b.nx);

  for (const z of sorted) {
    const zPos = relUV(z, zBox);
    const ranked = finalSlots
      .filter((f) => !usedFinal.has(f.id))
      .map((f) => {
        const fPos = relUV(f, fBox);
        const dx = zPos.u - fPos.u;
        const dy = zPos.v - fPos.v;
        return { f, dist: dx * dx + dy * dy };
      })
      .sort((a, b) => a.dist - b.dist || a.f.id - b.f.id);

    const pick = ranked[0]?.f ?? finalSlots[0]!;
    usedFinal.add(pick.id);
    mappings.push({ fromId: z.id, toId: pick.id, toNx: pick.nx, toNy: pick.ny });
  }

  return mappings;
}
