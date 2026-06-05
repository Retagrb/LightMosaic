function easeInCubic(t: number): number {
  return t * t * t;
}

export function buildSlotCounts(triggerCount: number, totalMaskSlots: number): number[] {
  if (totalMaskSlots <= 0) return [1];
  if (triggerCount <= 0) return [totalMaskSlots];

  const counts = new Array<number>(triggerCount).fill(0);
  const fractions = new Array<number>(triggerCount).fill(0);

  for (let i = 0; i < triggerCount; i++) {
    const f0 = i === 0 ? 0 : easeInCubic(i / triggerCount);
    const f1 = easeInCubic((i + 1) / triggerCount);
    fractions[i] = totalMaskSlots * (f1 - f0);
    counts[i] = Math.floor(fractions[i]);
  }

  let remainder = totalMaskSlots - counts.reduce((a, b) => a + b, 0);
  const order = [...Array(triggerCount).keys()].sort((a, b) => {
    const fa = fractions[a] - Math.floor(fractions[a]);
    const fb = fractions[b] - Math.floor(fractions[b]);
    if (fb !== fa) return fb - fa;
    return fractions[b] - fractions[a];
  });

  for (let r = 0; r < remainder; r++) counts[order[r % triggerCount]!]!++;

  for (let i = 0; i < triggerCount; i++) {
    if (counts[i]! >= 1) continue;
    for (let j = triggerCount - 1; j >= 0; j--) {
      if (counts[j]! <= 1) continue;
      counts[j]!--;
      counts[i]!++;
      break;
    }
  }

  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum !== totalMaskSlots) counts[triggerCount - 1]! += totalMaskSlots - sum;

  return counts;
}

export function slotCountForGraduate(
  graduateIndex1Based: number,
  triggerCount: number,
  totalMaskSlots: number,
): number {
  if (totalMaskSlots <= 0) return 1;
  if (triggerCount <= 0) return totalMaskSlots;
  const counts = buildSlotCounts(triggerCount, totalMaskSlots);
  const idx = Math.max(0, Math.min(graduateIndex1Based - 1, triggerCount - 1));
  return Math.max(1, counts[idx]!);
}
