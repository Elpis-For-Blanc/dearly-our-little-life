/** Stable, order-independent key for an unordered pair of character ids. */
export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('|')
}
