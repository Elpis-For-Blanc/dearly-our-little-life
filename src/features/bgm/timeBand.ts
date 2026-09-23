import type { TimeBand } from './bgmConfig'

/**
 * The single, shared source of "which time band is it right now" — every
 * other BGM module goes through this rather than re-deriving band
 * boundaries independently.
 *
 * 아침 05:00-10:59, 낮 11:00-16:59, 저녁 17:00-20:59, 밤 21:00-04:59.
 * `night` is deliberately the fallback branch (not an explicit range check)
 * so the midnight wrap (23시 → 0시) is handled correctly for free — there's
 * no seam to get wrong.
 */
export function getTimeBand(hour: number): TimeBand {
  if (hour >= 5 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 16) return 'daytime'
  if (hour >= 17 && hour <= 20) return 'evening'
  return 'night'
}

/**
 * The real-clock hour BGM bands are computed from. This is deliberately the
 * *same* plain `new Date().getHours()` real-system-clock signal already
 * used by `autoDialogueEngine.ts` (time-of-day line gating) and
 * `movementEngine.ts` (room-choice bias) — not the free-text "현재 시간"
 * input field on the Live screen. That field starts from real time
 * (`LiveScreen.tsx`'s `defaultTime()`) but is plain editable text the user
 * can overwrite with anything, so it isn't a functional clock — treating it
 * as one would make BGM band detection fragile or simply wrong after any
 * edit. This reuses the app's one genuine real-time source rather than
 * standing up a second, duplicate clock, per the spec's own instruction.
 */
export function getCurrentHour(): number {
  return new Date().getHours()
}

export const TIME_BAND_LABELS: Record<TimeBand, string> = {
  morning: '아침',
  daytime: '낮',
  evening: '저녁',
  night: '밤',
}
