import { useCharacterStore } from '../character/characterStore'
import { resolveWeightingTagIds } from '../character/personalityTags'
import type { CharacterMovementState } from '../simulation/characterMovementStore'
import { useCharacterMovementStore } from '../simulation/characterMovementStore'
import { useDialogueStore } from './dialogueStore'
import { MONOLOGUE_DISPLAY_MS, RECENT_TALK_WINDOW_MS, ROOM_ARRIVAL_WINDOW_MS } from './monologueConfig'
import { isMonologueAllowedActivity, pickMonologue, rollShouldMonologue } from './monologueEngine'
import { useMonologueFrequencyStore } from './monologueFrequencyStore'
import { useMonologueStore } from './monologueStore'
import type { MonologueActivity, MonologuePartner } from './monologueTypes'
import { pairKey } from './pairKey'
import { useRelationshipStore } from './relationshipStore'

/**
 * Maps real simulation state to a monologue activity. Only states the
 * simulation genuinely has are produced: just changed rooms, standing still
 * in a `rest`, walking somewhere, or otherwise standing around. There is no
 * sleep or work state in the app yet, so neither is ever returned here.
 */
export function deriveMonologueActivity(entry: CharacterMovementState, lastRoomArrivalAt: number | undefined, now: number): MonologueActivity {
  if (lastRoomArrivalAt !== undefined && now - lastRoomArrivalAt < ROOM_ARRIVAL_WINDOW_MS) return 'roomArrival'
  if (entry.restTicksRemaining > 0) return 'resting'
  if (entry.status === 'moving') return 'wandering'
  return 'idle'
}

/**
 * The other characters this one has a relationship with — only pairs whose
 * relationship the user actually chose (an unchosen pair merely resolves to
 * the default type and contributes nothing) — with the checkable facts
 * monologue lines may rely on: whether they currently share the same room, and
 * whether a real conversation between the two ended within
 * `RECENT_TALK_WINDOW_MS`. Each relationship-specific line then requires a
 * partner of *its* relationship type, so a character never gets a line for a
 * relationship it doesn't have.
 */
function collectRelatedPartners(characterId: string, entry: CharacterMovementState, now: number): MonologuePartner[] {
  const relationships = useRelationshipStore.getState()
  const movementById = useCharacterMovementStore.getState().byId
  const lastEndByPair = useDialogueStore.getState().lastConversationEndAtByPair
  const partners: MonologuePartner[] = []

  for (const other of useCharacterStore.getState().characters) {
    if (other.id === characterId) continue
    if (!relationships.isRelationshipExplicit(characterId, other.id)) continue
    const relationship = relationships.getRelationshipType(characterId, other.id)
    const otherEntry = movementById[other.id]
    if (!otherEntry) continue
    const lastEnd = lastEndByPair[pairKey(characterId, other.id)]
    partners.push({
      relationship,
      sameRoom: otherEntry.roomId === entry.roomId,
      recentTalk: lastEnd !== undefined && now - lastEnd < RECENT_TALK_WINDOW_MS,
    })
  }
  return partners
}

/**
 * One monologue pass, called once per movement tick from
 * `useCharacterMovementSimulation.ts` (which already gates on the global
 * pause flag) — no timer of its own. It only ever reads movement state and
 * writes `monologueStore`; it never touches a character's destination,
 * status or room, so it can't interrupt walking or a room change. Expiry is a
 * timestamp check here rather than a per-bubble timeout.
 */
export function runMonologuePass(now: number = Date.now(), hour: number = new Date().getHours(), random: () => number = Math.random): void {
  const mode = useMonologueFrequencyStore.getState().mode
  const monologues = useMonologueStore.getState()
  const dialogue = useDialogueStore.getState()
  const movementById = useCharacterMovementStore.getState().byId

  for (const character of useCharacterStore.getState().characters) {
    const id = character.id
    const active = monologues.activeByCharacter[id]
    const entry = movementById[id]

    // A conversation always wins: drop any monologue the moment the character is talking.
    if (dialogue.isCharacterBusy(id) || entry?.status === 'talking') {
      if (active) monologues.clearMonologue(id)
      continue
    }
    if (active && (mode === 'off' || now >= active.expiresAt)) monologues.clearMonologue(id)
    if (active || !entry || mode === 'off') continue

    const activity = deriveMonologueActivity(entry, monologues.lastRoomArrivalAtByCharacter[id], now)
    if (!isMonologueAllowedActivity(activity)) continue

    const personalityTags = resolveWeightingTagIds(character.aiProfile.personalityTags, character.aiProfile.customPersonalityTags)
    if (!rollShouldMonologue({ mode, personalityTags, now, lastMonologueAt: monologues.lastMonologueAtByCharacter[id], random })) continue

    const line = pickMonologue({
      personalityTags,
      baseTone: character.aiProfile.tone.baseTone,
      activity,
      hour,
      recentLineIds: monologues.recentLineIdsByCharacter[id] ?? [],
      partners: collectRelatedPartners(id, entry, now),
      random,
    })
    if (!line) continue

    monologues.showMonologue(id, line.id, line.text, now, MONOLOGUE_DISPLAY_MS)
  }
}
