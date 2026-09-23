import { MOOD_HAPPY_AVERAGE, NEED_CRITICAL_THRESHOLD } from './needsConfig'
import type { CharacterNeeds, Mood } from './needsTypes'

/**
 * Mood is always *derived* from the four needs, never its own stored field
 * — recomputed fresh every time it's displayed. Priority order when more
 * than one need is critically low at once: hunger, then energy, then
 * social, then fun — a deliberate, disclosed choice (the spec names all
 * four as valid triggers but doesn't order them), reasoning survival-style
 * needs (hunger/energy) as more urgent than the softer social/fun ones.
 * Only when *none* is critical does the overall average decide between
 * `'happy'` and `'neutral'`.
 */
export function deriveMood(needs: CharacterNeeds): Mood {
  if (needs.hunger <= NEED_CRITICAL_THRESHOLD) return 'hungry'
  if (needs.energy <= NEED_CRITICAL_THRESHOLD) return 'tired'
  if (needs.social <= NEED_CRITICAL_THRESHOLD) return 'lonely'
  if (needs.fun <= NEED_CRITICAL_THRESHOLD) return 'bored'

  const average = (needs.hunger + needs.energy + needs.fun + needs.social) / 4
  return average >= MOOD_HAPPY_AVERAGE ? 'happy' : 'neutral'
}

export const MOOD_LABELS: Record<Mood, string> = {
  happy: '행복해요',
  neutral: '평온해요',
  tired: '피곤해요',
  hungry: '배고파요',
  bored: '심심해요',
  lonely: '외로워요',
}
