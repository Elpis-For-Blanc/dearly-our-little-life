export interface SituationCategory {
  id: string
  label: string
}

/**
 * The original 10 built-in situations. Ids are stable strings (not
 * generated), so a dialogue line's `categoryId` keeps resolving correctly
 * across sessions even though these are defined in code, not the store.
 * Never rename or remove any of these — existing registered
 * `CharacterDialogueLine`s reference them by id.
 */
export const DEFAULT_SITUATION_CATEGORIES: SituationCategory[] = [
  { id: 'morning-greeting', label: '아침 인사' },
  { id: 'meal', label: '식사' },
  { id: 'casual-chat', label: '일상 대화' },
  { id: 'resting-together', label: '함께 휴식' },
  { id: 'calling-partner', label: '상대를 부를 때' },
  { id: 'worried', label: '걱정할 때' },
  { id: 'teasing', label: '장난칠 때' },
  { id: 'conflict', label: '다툼' },
  { id: 'reconciliation', label: '화해' },
  { id: 'bedtime', label: '취침 인사' },
  // Added for the default (no-example-lines-required) dialogue library —
  // more time-of-day-specific than the 10 above, so the built-in bundles in
  // defaultDialogueLibrary.ts can be gated to the right real-clock hour
  // window without overloading the older, broader ids' meaning (e.g. 'meal'
  // stays untouched and still matches any old registered line using it).
  { id: 'wake-up', label: '기상' },
  { id: 'breakfast', label: '아침 식사' },
  { id: 'lunch', label: '점심 식사' },
  { id: 'afternoon-chat', label: '오후 일상' },
  { id: 'snack', label: '간식' },
  { id: 'dinner', label: '저녁 식사' },
  { id: 'day-wrap-up', label: '하루 마무리' },
  { id: 'pre-bedtime', label: '취침 전' },
  { id: 'encounter', label: '우연히 마주침' },
  { id: 'comfort', label: '위로' },
  { id: 'compliment', label: '칭찬' },
  { id: 'favor', label: '부탁' },
  { id: 'gratitude', label: '감사' },
  { id: 'apology', label: '사과' },
  /**
   * "혼자 중얼거림" — included for completeness against the requested
   * situation list, but there is no solo-speech trigger anywhere in this
   * app (every dialogue path, auto or manual, is a two-character exchange —
   * see autoDialogueEngine.ts). Honestly inert: nothing currently selects a
   * line in this category. Not built, not faked.
   */
  { id: 'muttering', label: '혼자 중얼거림' },
]
