import { useCharacterStore } from '../character/characterStore'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { getFurnitureDefinition } from '../home/furnitureCatalog'
import { useHomeStore } from '../home/homeStore'
import type { InteractionKind } from '../home/types'
import { needsFurnitureWeight } from '../needs/needsFurnitureBonus'
import { useNeedsStore } from '../needs/needsStore'
import { useAutoFurnitureUseSettingsStore } from './autoFurnitureUseSettingsStore'
import { useAutoFurnitureUseStore } from './autoFurnitureUseStore'
import { collectAutoFurnitureCandidates, pickAutoFurnitureCandidate, pickHoldDurationMs, rollShouldStartAutoFurnitureUse, type AutoFurnitureCandidate } from './autoFurnitureUseEngine'
import { useCharacterMovementStore, type MovementStatus } from './characterMovementStore'
import { useFurnitureUsageStore } from './furnitureUsageStore'
import { standUp, startLingering, startLyingDown, startSitting, type SitOutcome } from './furnitureUsageTrigger'

const START_BY_KIND: Record<InteractionKind, (characterId: string, placementId: string, slotId?: string) => SitOutcome> = {
  sit: startSitting,
  lie: startLyingDown,
  stand: startLingering,
}

const OCCUPIED_STATUSES: ReadonlySet<MovementStatus> = new Set(['seated', 'lying', 'lingering'])

function seatKeyOf(active: { placementId: string; slotId: string }): string {
  return `${active.placementId}:${active.slotId}`
}

/**
 * Reconciles one character's auto-tracking entry (`autoFurnitureUseStore`)
 * against the real, shared reservation ledger (`furnitureUsageStore`) —
 * the single source of truth every manual action
 * (`FurnitureUsagePanel.tsx`'s buttons), conversation start
 * (`runConversation`'s own `standUp` calls), and every existing
 * deletion/move/rotate cleanup path (`releaseFurnitureUsage`/
 * `evictPlacementUsage`, called from `CharacterList.tsx`, `RoomTabs.tsx`,
 * `FurnitureItem.tsx`, `FurniturePropertiesPanel.tsx`, `DecorateScreen.tsx`,
 * and the movement tick's own orphan-rescue loop) already write to
 * directly.
 *
 * This function never calls any of those cleanup functions itself — it only
 * ever *detects* that one of them already ran (the seat this character's
 * auto session pointed at no longer matches, or is gone entirely) and
 * forgets its own now-stale bookkeeping. This is the same `stillActive`
 * guard shape `autoDialogueTrigger.ts`'s `runConversation` finally block
 * already established for exactly the same reason: a late reconciliation
 * must never redo work (re-seat, re-stand-up) that something else already
 * did, or fight a newer, unrelated state that formed in the meantime. It is
 * what makes every existing cleanup path correctly cancel an in-progress or
 * completed auto furniture use with **zero changes** to any of those
 * existing call sites — they don't know or need to know this feature
 * exists.
 *
 * Returns true if the character had an active auto session at the start of
 * this call (whether it's still ongoing or was just ended/discovered stale
 * this tick) — callers use this to skip a same-tick start attempt, so one
 * character can never both end and immediately begin a new auto session
 * within the same pass.
 */
function reconcile(characterId: string, now: number): boolean {
  const auto = useAutoFurnitureUseStore.getState().activeByCharacter[characterId]
  if (!auto) return false

  const usage = useFurnitureUsageStore.getState().byCharacterId[characterId]
  if (usage !== seatKeyOf(auto)) {
    // Something else already ended or reassigned this seat (manual override, conversation start, furniture
    // move/rotate/delete, room deletion relocation, character deletion, or the movement tick's own approach-timeout
    // release) — forget our own bookkeeping only. Never call standUp again here: whatever changed the seat has
    // already put the character into whatever state it should be in, and a redundant standUp risks clobbering that
    // newer, unrelated state.
    if (auto.standUpAt !== null) useAutoFurnitureUseStore.getState().endAuto(characterId, now) // did get to use it for a while — normal success cooldown
    else useAutoFurnitureUseStore.getState().markFailed(characterId, now) // never even arrived — shorter retry cooldown
    return true
  }

  const movement = useCharacterMovementStore.getState().byId[characterId]
  if (!movement) return true // character deleted mid-tick; syncCharacterIds drops the movement entry next cycle, nothing more to do here

  if (auto.standUpAt === null) {
    // Still walking over — mark the stand-up deadline the moment the shared movement tick has actually seated them
    // (completeFurnitureApproach, in useCharacterMovementSimulation.ts, is what flips this status on real arrival;
    // this function only ever observes it, never forces it).
    if (OCCUPIED_STATUSES.has(movement.status)) {
      useAutoFurnitureUseStore.getState().markSeated(characterId, now + pickHoldDurationMs())
    }
    return true
  }

  if (now >= auto.standUpAt) {
    standUp(characterId) // the existing, shared end-use function — never a duplicate
    useAutoFurnitureUseStore.getState().endAuto(characterId, now)
  }
  return true
}

/**
 * All of the spec's §2 start conditions that aren't already covered by
 * `rollShouldStartAutoFurnitureUse`'s cooldown/probability gate: the
 * setting must be on (checked inside the roll), the character must exist
 * and be in a valid room, not mid-conversation, not mid-manual-move/
 * manual-furniture-use, and not already approaching/using furniture
 * (auto or manual).
 */
function tryStart(characterId: string, now: number, random: () => number): void {
  const movement = useCharacterMovementStore.getState().byId[characterId]
  if (!movement) return
  if (movement.status === 'talking') return
  if (OCCUPIED_STATUSES.has(movement.status)) return // already using something (manually, since an auto session would have been reconciled already) — never take over
  if (useDialogueStore.getState().isCharacterBusy(characterId)) return
  if (useFurnitureUsageStore.getState().byCharacterId[characterId]) return // already reserved/approaching (manual) — reconcile above already excludes auto's own

  const auto = useAutoFurnitureUseStore.getState()
  const shouldStart = rollShouldStartAutoFurnitureUse({
    enabled: useAutoFurnitureUseSettingsStore.getState().enabled,
    now,
    lastEndedAt: auto.lastEndedAtByCharacter[characterId],
    lastFailedAt: auto.lastFailedAtByCharacter[characterId],
    random,
  })
  if (!shouldStart) return

  const room = useHomeStore.getState().rooms.find((r) => r.id === movement.roomId)
  if (!room) return // orphaned room — the movement tick's own rescue loop handles this before this pass runs

  const candidates = collectAutoFurnitureCandidates(room.furniture, useFurnitureUsageStore.getState().bySeatKey)
  // A light bonus toward rest-like/leisure-like furniture when energy/fun are low — see needsFurnitureBonus.ts's own
  // doc comment for why hunger/social aren't part of this yet. Still a genuinely random *weighted* pick, never a
  // deterministic "always the best match" rule — undefined needs (character not yet synced into needsStore) falls
  // back to the exact same uniform pick every existing test already exercises.
  const needs = useNeedsStore.getState().byId[characterId]
  const weightFor = needs
    ? (candidate: AutoFurnitureCandidate) => {
        const placement = room.furniture.find((f) => f.id === candidate.placementId)
        const definition = placement ? getFurnitureDefinition(placement.furnitureId) : undefined
        return definition ? needsFurnitureWeight(definition, needs) : 1
      }
    : undefined
  const candidate = pickAutoFurnitureCandidate(candidates, auto.recentPlacementIdsByCharacter[characterId] ?? [], random, weightFor)
  if (!candidate) return // no reachable, empty slot in this room right now — try again next eligible tick, never a forced retry loop

  // Reuse the existing, already-verified reservation+approach flow — never a duplicate sit/lie engine. Real,
  // collision-checked walking and arrival-seating are handled entirely by the ordinary movement tick from here,
  // exactly as for a manual click.
  const outcome = START_BY_KIND[candidate.kind](characterId, candidate.placementId, candidate.slotId)
  if (outcome === 'started') {
    useAutoFurnitureUseStore.getState().startAuto(characterId, candidate.placementId, candidate.slotId, movement.roomId)
    useAutoFurnitureUseStore.getState().recordUsed(characterId, candidate.placementId)
  } else {
    // Lost a same-tick reservation race (another character, auto or manual, took it a moment earlier in this same
    // pass) or some other guard refused — don't hammer it again next tick.
    useAutoFurnitureUseStore.getState().markFailed(characterId, now)
  }
}

/**
 * The single entry point for automatic furniture use — called exactly once
 * per movement tick from `useCharacterMovementSimulation.ts`, mirroring
 * `monologueTrigger.ts`'s `runMonologuePass` hook-point exactly: no timer of
 * its own, reuses the one existing simulation tick, and is the only place
 * in the codebase that ever starts or ends an *automatic* furniture-use
 * session. For each character: first reconcile any in-progress auto session
 * against the real, shared `furnitureUsageStore` (stand it up on schedule,
 * or discover it was already ended/reassigned elsewhere); only a character
 * with no active session *after* that is even considered for starting a new
 * one this tick. This ordering is what guarantees a character can never be
 * mid-auto-session and also attempt to start a second one within the same
 * tick — the whole pass runs exactly once, synchronously, per character,
 * per tick.
 */
export function runAutoFurnitureUsePass(now: number = Date.now(), random: () => number = Math.random): void {
  for (const character of useCharacterStore.getState().characters) {
    const hadActiveSession = reconcile(character.id, now)
    if (hadActiveSession) continue
    tryStart(character.id, now, random)
  }
}
