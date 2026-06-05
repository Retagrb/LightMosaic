import type { LayoutRect } from '../layout/stageLayout';
import { slotToScreen } from '../layout/stageLayout';
import type { SlotPoint } from '../types/ceremony';

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function screenBounds(points: SlotPoint[], layout: LayoutRect): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    const pos = slotToScreen(point, layout);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  return { minX, minY, maxX, maxY };
}

export function splitFinalMask(
  points: SlotPoint[],
  characterCutoffs: readonly number[],
): {
  characters: SlotPoint[][];
  firstCharacter: SlotPoint[];
  extraCharacters: SlotPoint[];
} {
  const [firstCutoff, secondCutoff, thirdCutoff] = characterCutoffs;
  if (
    firstCutoff === undefined ||
    secondCutoff === undefined ||
    thirdCutoff === undefined
  ) {
    return {
      characters: [points, [], [], []],
      firstCharacter: points,
      extraCharacters: [],
    };
  }

  const ranges: Array<[number, number]> = [
    [0, firstCutoff],
    [firstCutoff, secondCutoff],
    [secondCutoff, thirdCutoff],
    [thirdCutoff, 1],
  ];
  const characters = ranges.map(([minX, maxX], index) =>
    points.filter(
      (point) =>
        point.nx >= minX &&
        (index === ranges.length - 1 ? point.nx <= maxX : point.nx < maxX),
    ),
  );

  return {
    characters,
    firstCharacter: characters[0] ?? [],
    extraCharacters: characters.slice(1).flat(),
  };
}

/** Preserve the completed 卓 shape while fitting it into the first-character area. */
export function buildPreservedSymbolTargets(
  symbolPoints: SlotPoint[],
  symbolLayout: LayoutRect,
  firstCharacterPoints: SlotPoint[],
  finalLayout: LayoutRect,
): Map<number, { x: number; y: number }> {
  const targets = new Map<number, { x: number; y: number }>();
  if (symbolPoints.length === 0 || firstCharacterPoints.length === 0) return targets;

  const source = screenBounds(symbolPoints, symbolLayout);
  const target = screenBounds(firstCharacterPoints, finalLayout);
  const sourceWidth = Math.max(1, source.maxX - source.minX);
  const sourceHeight = Math.max(1, source.maxY - source.minY);
  const targetWidth = Math.max(1, target.maxX - target.minX);
  const targetHeight = Math.max(1, target.maxY - target.minY);
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const sourceCenterX = (source.minX + source.maxX) / 2;
  const sourceCenterY = (source.minY + source.maxY) / 2;
  const targetCenterX = (target.minX + target.maxX) / 2;
  const targetCenterY = (target.minY + target.maxY) / 2;

  for (const point of symbolPoints) {
    const sourcePos = slotToScreen(point, symbolLayout);
    targets.set(point.id, {
      x: targetCenterX + (sourcePos.x - sourceCenterX) * scale,
      y: targetCenterY + (sourcePos.y - sourceCenterY) * scale,
    });
  }

  return targets;
}

export function rightEdgeCenter(
  positions: Map<number, { x: number; y: number }>,
): { x: number; y: number } {
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  return {
    x: Number.isFinite(maxX) ? maxX : 0,
    y: Number.isFinite(minY) && Number.isFinite(maxY) ? (minY + maxY) / 2 : 0,
  };
}
