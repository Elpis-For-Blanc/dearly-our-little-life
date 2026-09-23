/**
 * The four genuinely new character-to-character interaction kinds this
 * system tracks its own session for. `talk` — also requested as one of the
 * five — is deliberately **not** part of this set: it delegates entirely to
 * the already-existing, already-tested `autoDialogueTrigger.ts`/
 * `dialogueStore.ts` conversation system (its own encounter-triggered auto
 * path, its own manual "대화하기" entry point, its own "○○와 대화 중" bubble
 * UI) rather than a second, duplicate talk engine — see
 * `characterInteractionTrigger.ts`'s own doc comment for the full reasoning
 * and for how the two systems stay mutually aware (neither can double-book
 * a character the other is using).
 */
export type CharacterInteractionType = 'stayTogether' | 'sitTogether' | 'hug' | 'holdHands'

/** All five interaction kinds the manual UI offers — `'talk'` included here only as a UI-facing identifier; starting it routes straight to the existing dialogue engine, never through this feature's own session store. */
export type ManualInteractionChoice = 'talk' | CharacterInteractionType

/**
 * `'approaching'` — the session exists (busy-locking both participants
 * already applies) but they haven't both actually arrived in position yet.
 * `'active'` — both are in position and the held duration is counting down.
 */
export type CharacterInteractionPhase = 'approaching' | 'active'

/**
 * Runtime-only session state — deliberately not persisted (see
 * `characterInteractionStore.ts`'s own doc comment) and deliberately its own
 * store rather than a field stuffed into `characterMovementStore`/
 * `needsStore`, mirroring `furnitureUsageStore.ts`'s own "one small store
 * per concern" precedent.
 */
export interface CharacterInteractionSession {
  id: string
  type: CharacterInteractionType
  characterAId: string
  characterBId: string
  roomId: string
  phase: CharacterInteractionPhase
  /** Set only once `phase` becomes `'active'` — null while still approaching. */
  startedAt: number | null
  /** How long (ms) the `'active'` phase lasts once both are in position. */
  duration: number
  /**
   * `sitTogether` only — the two seat keys (`placementId:slotId`, see
   * `furnitureUsageStore.ts`) reserved for this session, so ending it (or
   * discovering one was invalidated externally — the seat's own furniture
   * was deleted/moved, or a seat was manually vacated) can act on them
   * directly without re-deriving placement/slot ids from scratch.
   */
  seatKeys?: { a: string; b: string }
  /** How much of `type`'s total social recovery has already been applied this session — only ever nonzero for `stayTogether`, whose recovery is spread incrementally across the whole `'active'` phase rather than granted as one lump sum at the end (see `characterInteractionConfig.ts`'s `SOCIAL_RECOVERY` doc comment). */
  socialRecoveryApplied: number
  /**
   * Which horizontal side each participant ends up facing once `'active'`
   * begins — only ever set for `hug`/`holdHands` (`facingMode: 'faceEachOther'`
   * in `characterInteractionConfig.ts`'s `FREEFORM_INTERACTION_DISTANCE`),
   * `null` otherwise (`sitTogether`/`stayTogether`, or a degenerate
   * exactly-overlapping position). `'right'` means facing toward +X.
   * Genuinely computed and tested, but **not yet rendered** — see
   * `FacingMode`'s own doc comment in that file for why a visual flip isn't
   * safe to add yet for arbitrary user-uploaded character art.
   */
  facing: { characterAId: 'left' | 'right'; characterBId: 'left' | 'right' } | null
}
