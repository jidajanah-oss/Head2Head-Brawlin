export function advancePickWeeks(currentWeek: number): number[] {
  if (!Number.isInteger(currentWeek) || currentWeek < 1 || currentWeek > 18) return [];
  return Array.from({ length: Math.min(3, 19 - currentWeek) }, (_, index) => currentWeek + index);
}
