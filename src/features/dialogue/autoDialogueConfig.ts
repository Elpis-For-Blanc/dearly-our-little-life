export type DialogueFrequencyMode = 'quiet' | 'occasional' | 'normal' | 'chatty' | 'rowdy'

export interface DialogueFrequencySettings {
  label: string
  description: string
  /** Probability [0, 1] that an actual encounter (two characters coming within ENCOUNTER_DISTANCE) rolls a new conversation. 0 means encounters never start one. */
  chancePerEncounter: number
  /** Minimum real time (ms) after a conversation between a given pair ends before that same pair can start another. */
  cooldownMs: number
}

/**
 * There is no in-game time multiplier system in this project (checked
 * before picking these numbers) — `cooldownMs` is a plain real-world
 * millisecond value, not scaled by anything. `chancePerEncounter` is rolled
 * once per real proximity event (`features/simulation/useCharacterMovementSimulation.ts`
 * detects it, `features/dialogue/autoDialogueTrigger.ts` rolls it) — not a
 * fixed timer, so the actual real-time frequency of conversations also
 * depends on how often characters happen to wander near each other (room
 * size, character count, movement speed). The mode descriptions below
 * deliberately don't promise a specific average time for this reason.
 * `cooldownMs` is a hard floor on top of the roll, per-pair, which is what
 * actually prevents 'rowdy' from producing a runaway/back-to-back
 * conversation loop between two characters who just keep standing next to
 * each other.
 *
 * Both the "대화 빈도" UI (`LiveScreen.tsx`) and the engine
 * (`autoDialogueTrigger.ts`) read these values from here — never duplicate
 * a number from this table elsewhere.
 */

/** Delay between each auto-dialogue bubble appearing, so a 2-4 line bundle reads as a conversation instead of dumping all at once. */
export const BUBBLE_REVEAL_INTERVAL_MS = 2_200

/** How often a paused conversation re-checks whether it can resume. */
export const PAUSE_POLL_INTERVAL_MS = 500

/** How many of a character's most recent auto-dialogue line ids are excluded from re-selection, per character. */
export const RECENT_LINE_HISTORY_SIZE = 6

/** How many of a *pair's* most recently-used default-library bundle ids (defaultDialogueLibrary.ts) are soft-avoided for re-selection — tracked separately per pair from RECENT_LINE_HISTORY_SIZE's per-character line tracking, per spec: "캐릭터별 기록과 캐릭터 쌍별 기록을 구분해줘". */
export const RECENT_BUNDLE_HISTORY_SIZE = 5

/** An auto-dialogue bundle is always 2-4 lines (inclusive), per spec. */
export const MIN_BUNDLE_LINES = 2
export const MAX_BUNDLE_LINES = 4

export const DIALOGUE_FREQUENCY_PRESETS: Record<DialogueFrequencyMode, DialogueFrequencySettings> = {
  quiet: {
    label: '조용히',
    description: '자동 대화가 발생하지 않아요. 캐릭터는 평소대로 지내고, 직접 대화하기는 계속 사용할 수 있어요.',
    chancePerEncounter: 0,
    cooldownMs: 0,
  },
  occasional: {
    label: '가끔',
    description: '마주쳐도 대화를 시작하는 경우가 드물어요.',
    chancePerEncounter: 0.15,
    cooldownMs: 120_000,
  },
  normal: {
    label: '보통',
    description: '마주치면 자연스러운 확률로 대화를 나눠요.',
    chancePerEncounter: 0.4,
    cooldownMs: 60_000,
  },
  chatty: {
    label: '수다쟁이',
    description: '마주치면 대부분 서로 말을 걸어요.',
    chancePerEncounter: 0.7,
    cooldownMs: 25_000,
  },
  rowdy: {
    label: '왁자지껄',
    description: '마주칠 때마다 거의 항상 대화해요. 쿨다운으로 대화가 끊임없이 반복되지는 않아요.',
    chancePerEncounter: 0.9,
    cooldownMs: 12_000,
  },
}

export const DIALOGUE_FREQUENCY_ORDER: DialogueFrequencyMode[] = ['quiet', 'occasional', 'normal', 'chatty', 'rowdy']

export const DEFAULT_DIALOGUE_FREQUENCY: DialogueFrequencyMode = 'normal'
