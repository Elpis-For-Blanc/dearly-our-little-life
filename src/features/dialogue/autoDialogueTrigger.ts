import { useCharacterStore } from '../character/characterStore'
import { resolveWeightingTagIds } from '../character/personalityTags'
import type { Character } from '../character/types'
import { useCharacterInteractionStore } from '../interaction/characterInteractionStore'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { standUp } from '../simulation/furnitureUsageTrigger'
import { useSimulationStore } from '../simulation/simulationStore'
import { BUBBLE_REVEAL_INTERVAL_MS, PAUSE_POLL_INTERVAL_MS } from './autoDialogueConfig'
import { buildAutoDialogueBundle, pickFirstSpeaker, rollShouldStartConversation, type AutoDialogueParticipant } from './autoDialogueEngine'
import { useDialogueFrequencyStore } from './dialogueFrequencyStore'
import { useDialogueStore } from './dialogueStore'
import { useMonologueStore } from './monologueStore'
import { pairKey } from './pairKey'
import type { RelationshipType } from './relationshipConfig'
import { useRelationshipStore } from './relationshipStore'
import type { DialogueSituation } from './types'

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Both the bubble reveal delay and the next line are suspended (not just visually hidden) while paused. */
function waitWhileNotRunning(mountedRef: { current: boolean }) {
  return new Promise<void>((resolve) => {
    function check() {
      if (!mountedRef.current || useSimulationStore.getState().isRunning) {
        resolve()
        return
      }
      setTimeout(check, PAUSE_POLL_INTERVAL_MS)
    }
    check()
  })
}

function toParticipant(character: Character): AutoDialogueParticipant {
  return {
    id: character.id,
    personalityTags: resolveWeightingTagIds(character.aiProfile.personalityTags, character.aiProfile.customPersonalityTags),
    dialogueLines: character.aiProfile.dialogueLines,
    baseTone: character.aiProfile.tone.baseTone,
  }
}

export type ConversationOutcome = 'started' | 'busy' | 'no_candidates' | 'missing_characters'

/**
 * Shared core reused by both the encounter-triggered auto-dialogue path and
 * the manual "대화하기" button — the only difference between them is
 * whether `rollShouldStartConversation` gates entry first (see the two
 * exported functions below). Locks both participants busy, builds a
 * personality/relationship-weighted bundle from their own registered
 * `CharacterDialogueLine`s, reveals bubbles one at a time (pause-aware via
 * `waitWhileNotRunning`), records recent-line usage, and — however it
 * exits — always releases the busy-lock, movement status, and floating
 * speech bubbles in `finally`.
 */
async function runConversation(
  charA: Character,
  charB: Character,
  relationshipType: RelationshipType,
  relationshipExplicit: boolean,
  situationRef: { current: DialogueSituation },
  mountedRef: { current: boolean },
): Promise<ConversationOutcome> {
  const key = pairKey(charA.id, charB.id)
  // A character mid-stayTogether/sitTogether/hug/holdHands (features/interaction/) is exactly as busy as one
  // mid-conversation — checked here, the one choke point both the encounter-triggered and manual talk paths share,
  // so neither system can ever double-book a character the other is using.
  if (useCharacterInteractionStore.getState().isCharacterBusy(charA.id) || useCharacterInteractionStore.getState().isCharacterBusy(charB.id)) return 'busy'
  const conversationId = useDialogueStore.getState().startConversation([charA.id, charB.id])
  if (!conversationId) return 'busy'

  // A conversation always wins over furniture use — a character mid-approach or already seated stands up cleanly
  // (repositioned to their own safe approach point, reservation released) before being marked 'talking', rather than
  // silently overwriting 'seated' and leaving a dangling seat reservation for the rest of the conversation.
  standUp(charA.id)
  standUp(charB.id)

  useCharacterMovementStore.getState().setStatus(charA.id, 'talking')
  useCharacterMovementStore.getState().setStatus(charB.id, 'talking')
  // Real dialogue takes priority: end any monologue bubble either participant is showing.
  useMonologueStore.getState().clearMonologue(charA.id)
  useMonologueStore.getState().clearMonologue(charB.id)

  try {
    const participants: [AutoDialogueParticipant, AutoDialogueParticipant] = [toParticipant(charA), toParticipant(charB)]
    const firstSpeaker = pickFirstSpeaker(participants)
    const bundle = buildAutoDialogueBundle({
      participants,
      firstSpeakerId: firstSpeaker.id,
      relationshipType,
      relationshipExplicit,
      recentLineIdsByCharacter: useDialogueStore.getState().recentAutoLineIdsByCharacter,
      recentDefaultBundleIdsByPair: useDialogueStore.getState().recentDefaultBundleIdsByPair[key] ?? [],
      now: Date.now(),
    })

    if (!bundle) return 'no_candidates'
    if (bundle.usedDefaultBundleId) useDialogueStore.getState().recordDefaultBundleUsed(key, bundle.usedDefaultBundleId)

    const context = {
      gameTime: situationRef.current.time,
      place: situationRef.current.place,
      action: [situationRef.current.actionA, situationRef.current.actionB].filter(Boolean).join(' / '),
    }

    for (const line of bundle.lines) {
      await waitWhileNotRunning(mountedRef)
      if (!mountedRef.current) return 'started'
      useDialogueStore.getState().appendLines([line], context)
      useDialogueStore.getState().setActiveBubble(line.speakerId, line.text)
      await delay(BUBBLE_REVEAL_INTERVAL_MS)
    }

    for (const used of bundle.usedLineIds) {
      useDialogueStore.getState().recordAutoLineUsed(used.characterId, used.lineId)
    }
    return 'started'
  } finally {
    // `endActiveConversationsFor` (below) can already have force-ended this exact conversation — e.g. one participant
    // was deleted, or this room got deleted mid-conversation — and by now may even have let a participant start a
    // *new* conversation (isCharacterBusy only returns true while this conversationId is still in activeConversations).
    // If that already happened, this tail must not touch anything: ending an already-gone id is a harmless no-op, but
    // clearing bubbles / resetting movement here would clobber whatever that newer state already is. Only a
    // conversation nobody else has touched yet reaches this branch in the normal (uninterrupted) case.
    if (conversationId in useDialogueStore.getState().activeConversations) {
      useDialogueStore.getState().endConversation(conversationId, key)
      useDialogueStore.getState().clearActiveBubble(charA.id)
      useDialogueStore.getState().clearActiveBubble(charB.id)
      // Resets both participants back to a genuinely fresh "pick something new" state — not just status/destination. Clearing destinationRoomId/currentBehavior here matters specifically for a character who was mid-room-change (walking to a doorway) when the encounter interrupted them: leaving destinationRoomId set with destination cleared would make the *next* unrelated destination they reach get misread as "arrived at the doorway", teleporting them into a room they never actually walked to.
      for (const characterId of [charA.id, charB.id]) {
        useCharacterMovementStore.getState().setStatus(characterId, 'idle')
        useCharacterMovementStore.getState().setDestination(characterId, null)
        useCharacterMovementStore.getState().setDestinationRoomId(characterId, null)
        useCharacterMovementStore.getState().setCurrentBehavior(characterId, null)
      }
    }
  }
}

/**
 * Immediately, synchronously ends every conversation `characterId` is part of
 * right now — the one thing `runConversation`'s own `finally` can't do on its
 * own, since that only runs once the conversation's async bubble-reveal chain
 * naturally finishes (up to several seconds later). Used whenever something
 * external needs the conversation gone *now*: the character was deleted
 * (`characterStore.removeCharacter`), or its room was deleted out from under
 * it. Does the exact same cleanup `runConversation`'s finally does — ends the
 * conversation, clears both participants' bubbles, and resets movement
 * status/destination for whichever participant still exists — so a survivor
 * can move and start a new conversation immediately, not several seconds
 * later. The original `runConversation` call for this pair is still running
 * in the background; its own `finally` checks whether its conversationId is
 * still active before doing anything, so it becomes a safe no-op once this
 * has already run (see the comment there).
 */
export function endActiveConversationsFor(characterId: string): void {
  const state = useDialogueStore.getState()
  for (const [conversationId, participants] of Object.entries(state.activeConversations)) {
    if (!participants.includes(characterId)) continue
    const [a, b] = participants
    useDialogueStore.getState().endConversation(conversationId, pairKey(a, b))
    for (const id of participants) {
      useDialogueStore.getState().clearActiveBubble(id)
      // A no-op for a character that no longer exists (characterMovementStore's updateEntry guards on the entry existing) — harmless, and correct for the surviving participant.
      useCharacterMovementStore.getState().setStatus(id, 'idle')
      useCharacterMovementStore.getState().setDestination(id, null)
      useCharacterMovementStore.getState().setDestinationRoomId(id, null)
      useCharacterMovementStore.getState().setCurrentBehavior(id, null)
    }
  }
}

/**
 * Attempts to start (and, if the probability roll and candidate-selection
 * succeed, fully runs) an auto-dialogue conversation between two characters
 * who just encountered each other. Called exactly once per rising-edge
 * encounter by `useCharacterMovementSimulation.ts` — never on a fixed timer.
 * Implements steps 3-10 of the spec's 10-step flow (encounter detection
 * itself, step 1-2, lives in the movement simulation).
 */
export async function attemptEncounterConversation(
  characterAId: string,
  characterBId: string,
  situationRef: { current: DialogueSituation },
  mountedRef: { current: boolean },
): Promise<void> {
  const characters = useCharacterStore.getState().characters
  const charA = characters.find((c) => c.id === characterAId)
  const charB = characters.find((c) => c.id === characterBId)
  if (!charA || !charB) return

  const key = pairKey(characterAId, characterBId)
  const frequencyMode = useDialogueFrequencyStore.getState().mode
  const relationshipType = useRelationshipStore.getState().getRelationshipType(characterAId, characterBId)
  const now = Date.now()
  const lastConversationEndAt = useDialogueStore.getState().lastConversationEndAtByPair[key] ?? 0

  const shouldStart = rollShouldStartConversation({
    frequencyMode,
    relationshipType,
    now,
    lastConversationEndAt,
    participantPersonalityTags: [
      resolveWeightingTagIds(charA.aiProfile.personalityTags, charA.aiProfile.customPersonalityTags),
      resolveWeightingTagIds(charB.aiProfile.personalityTags, charB.aiProfile.customPersonalityTags),
    ],
  })
  if (!shouldStart) return

  await runConversation(charA, charB, relationshipType, useRelationshipStore.getState().isRelationshipExplicit(characterAId, characterBId), situationRef, mountedRef)
}

/**
 * Manual "대화하기" trigger — reuses the exact same local dialogue engine
 * (personality/relationship weighting, recent-line exclusion, pause-aware
 * bubble reveal, busy-locking) as the encounter-triggered path, but skips
 * the frequency-mode/probability gate entirely: an explicit button click is
 * already the "should this happen" decision. Works in every frequency mode
 * including 'quiet', which only ever gates the *automatic* trigger.
 */
export async function startManualConversation(
  characterAId: string,
  characterBId: string,
  situationRef: { current: DialogueSituation },
  mountedRef: { current: boolean },
): Promise<ConversationOutcome> {
  const characters = useCharacterStore.getState().characters
  const charA = characters.find((c) => c.id === characterAId)
  const charB = characters.find((c) => c.id === characterBId)
  if (!charA || !charB) return 'missing_characters'

  const relationshipType = useRelationshipStore.getState().getRelationshipType(characterAId, characterBId)
  return runConversation(charA, charB, relationshipType, useRelationshipStore.getState().isRelationshipExplicit(characterAId, characterBId), situationRef, mountedRef)
}
