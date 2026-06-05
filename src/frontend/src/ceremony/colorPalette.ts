import { hashString } from '../util/random';

const COLORS = [0xffd700];

export function pickColor(ceremonySeed: string, graduateId: string): number {
  const h = hashString(`${ceremonySeed}:color:${graduateId}`);
  return COLORS[h % COLORS.length]!;
}
