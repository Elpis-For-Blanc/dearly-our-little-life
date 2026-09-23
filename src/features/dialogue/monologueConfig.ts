export type MonologueFrequencyMode = 'off' | 'rare' | 'normal' | 'frequent' | 'veryFrequent'

export interface MonologueFrequencySettings {
  label: string
  description: string
  /**
   * Probability [0, 1] that an *eligible* character (cooldown elapsed, not in a
   * conversation, simulation running) starts a monologue on any single movement
   * tick (MOVEMENT_TICK_MS = 250ms, i.e. 4 rolls/second). Rolled per tick, not
   * per character-per-minute, because monologue reuses the one existing
   * simulation tick instead of running its own timer.
   */
  chancePerTick: number
  /** Minimum real time (ms) after one of *this character's* monologues starts before it may start another. Independent per character. Never lower than MIN_MONOLOGUE_COOLDOWN_MS. */
  cooldownMs: number
}

/** Hard floor on any mode's cooldown so bubbles can never become constant, whatever a preset says. */
export const MIN_MONOLOGUE_COOLDOWN_MS = 8_000

/** How long a monologue bubble stays on screen. The bubble's CSS animation fades it out over the same duration (CharacterToken.css), and the tick removes it from the store at expiry — no per-bubble timer. */
export const MONOLOGUE_DISPLAY_MS = 5_000

/** After a character actually changes rooms, it counts as "just arrived" (a monologue trigger context) for this long. */
export const ROOM_ARRIVAL_WINDOW_MS = 6_000

/** A conversation between a pair that ended this recently counts as "just talked" for relationship monologue lines. */
export const RECENT_TALK_WINDOW_MS = 3 * 60_000

/** How many of a character's most recent monologue line ids are excluded from re-selection. Tracked separately from the two-person dialogue's recency records on purpose. */
export const RECENT_MONOLOGUE_HISTORY_SIZE = 8

/** Monologue chance multiplier bounds, after personality (수다스러움/과묵함) is applied. */
export const MONOLOGUE_CHANCE_WEIGHT_MIN = 0.25
export const MONOLOGUE_CHANCE_WEIGHT_MAX = 2.5

/**
 * Values are separate per mode: `chancePerTick` (how eager an off-cooldown
 * character is) and `cooldownMs` (the hard floor between one character's
 * monologues). Both the "혼잣말 빈도" UI (LiveScreen.tsx) and the trigger
 * (monologueTrigger.ts) read only from here.
 */
export const MONOLOGUE_FREQUENCY_PRESETS: Record<MonologueFrequencyMode, MonologueFrequencySettings> = {
  off: {
    label: '끄기',
    description: '캐릭터가 혼잣말을 하지 않아요. 캐릭터 간 대화는 그대로예요.',
    chancePerTick: 0,
    cooldownMs: 0,
  },
  rare: {
    label: '가끔',
    description: '캐릭터가 아주 드물게 혼잣말을 해요.',
    chancePerTick: 0.0015,
    cooldownMs: 120_000,
  },
  normal: {
    label: '보통',
    description: '캐릭터가 가끔 자연스럽게 혼잣말을 해요.',
    chancePerTick: 0.004,
    cooldownMs: 45_000,
  },
  frequent: {
    label: '자주',
    description: '캐릭터가 꽤 자주 혼잣말을 해요.',
    chancePerTick: 0.01,
    cooldownMs: 25_000,
  },
  veryFrequent: {
    label: '매우 자주',
    description: '캐릭터가 활발하게 혼잣말을 해요. 그래도 최소 쿨다운은 지켜져요.',
    chancePerTick: 0.025,
    cooldownMs: 12_000,
  },
}

export const MONOLOGUE_FREQUENCY_ORDER: MonologueFrequencyMode[] = ['off', 'rare', 'normal', 'frequent', 'veryFrequent']

export const DEFAULT_MONOLOGUE_FREQUENCY: MonologueFrequencyMode = 'normal'
