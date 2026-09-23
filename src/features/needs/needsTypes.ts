/** A character's four basic needs, each 0 (매우 부족) – 100 (매우 충족). */
export interface CharacterNeeds {
  hunger: number
  energy: number
  fun: number
  social: number
}

/**
 * Always a *derived* value (see `moodEngine.ts`'s `deriveMood`) — never
 * stored on its own, per the spec's own "기분은 저장되는 원본 데이터라기보다는
 * 욕구값에서 계산되는 derived state로 만드는 것을 우선 고려". Nothing
 * persists a `Mood` anywhere; it's recomputed from `CharacterNeeds` every
 * time it's needed.
 */
export type Mood = 'happy' | 'neutral' | 'tired' | 'hungry' | 'bored' | 'lonely'
