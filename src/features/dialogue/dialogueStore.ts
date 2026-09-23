import { create } from 'zustand'
import { RECENT_BUNDLE_HISTORY_SIZE, RECENT_LINE_HISTORY_SIZE } from './autoDialogueConfig'
import type { DialogueLine } from './types'

export interface DialogueEntry extends DialogueLine {
  id: string
  gameTime: string
  place: string
  action: string
}

interface DialogueContext {
  gameTime: string
  place: string
  action: string
}

/**
 * `activeConversations`, `lastConversationEndAtByPair` and
 * `recentAutoLineIdsByCharacter` are runtime scheduling state for the
 * auto-dialogue engine (features/dialogue/autoDialogueTrigger.ts) —
 * deliberately in this non-persisted store (no `persist` middleware here),
 * never written to localStorage or exported JSON.
 *
 * With up to 5 characters, multiple disjoint pairs can converse at the same
 * time (e.g. A/B while C/D talk separately) — `activeConversations` is keyed
 * by a generated conversation id so several can coexist, and
 * `isCharacterBusy` is what enforces "no character in 2 conversations at
 * once": every start attempt must check it for every intended participant
 * before locking them in.
 */
interface DialogueState {
  entries: DialogueEntry[]
  activeConversations: Record<string, string[]>
  lastConversationEndAtByPair: Record<string, number>
  recentAutoLineIdsByCharacter: Record<string, string[]>
  /** Which default-library bundle ids (defaultDialogueLibrary.ts) each *pair* (keyed by pairKey.ts) has recently been given — kept separate from `recentAutoLineIdsByCharacter` on purpose, per spec: pair-level and character-level recency are distinct records. Only ever written when a conversation actually used the default-library fallback, never for a registered-line bundle. */
  recentDefaultBundleIdsByPair: Record<string, string[]>
  /** A character's current line while it's "on screen" above their sprite in LiveRoomView — cleared when their conversation ends, not on a timer. Keyed by character id, so it's correct regardless of how many conversations are active at once. */
  activeBubbleByCharacter: Record<string, string>
  /** Appends — a new conversation must never replace or reorder earlier lines. */
  appendLines: (lines: DialogueLine[], context: DialogueContext) => void
  isCharacterBusy: (characterId: string) => boolean
  /** Returns a conversation id on success, or null (and does nothing) if any participant is already in another conversation. */
  startConversation: (participantIds: string[]) => string | null
  /** `pairKeyValue` should be `pairKey(idA, idB)` for the two participants — used to stamp that pair's own cooldown reference time. */
  endConversation: (conversationId: string, pairKeyValue: string) => void
  recordAutoLineUsed: (characterId: string, lineId: string) => void
  recordDefaultBundleUsed: (pairKeyValue: string, bundleId: string) => void
  setActiveBubble: (characterId: string, text: string) => void
  clearActiveBubble: (characterId: string) => void
}

export const useDialogueStore = create<DialogueState>((set, get) => ({
  entries: [],
  activeConversations: {},
  lastConversationEndAtByPair: {},
  recentAutoLineIdsByCharacter: {},
  recentDefaultBundleIdsByPair: {},
  activeBubbleByCharacter: {},
  appendLines: (lines, context) =>
    set((state) => ({
      entries: [
        ...state.entries,
        ...lines.map((line) => ({
          ...line,
          id: crypto.randomUUID(),
          gameTime: context.gameTime,
          place: context.place,
          action: context.action,
        })),
      ],
    })),
  isCharacterBusy: (characterId) => Object.values(get().activeConversations).some((ids) => ids.includes(characterId)),
  startConversation: (participantIds) => {
    const state = get()
    if (participantIds.some((id) => state.isCharacterBusy(id))) return null

    const conversationId = crypto.randomUUID()
    set({ activeConversations: { ...state.activeConversations, [conversationId]: participantIds } })
    return conversationId
  },
  endConversation: (conversationId, pairKeyValue) =>
    set((state) => {
      const { [conversationId]: _removed, ...rest } = state.activeConversations
      return {
        activeConversations: rest,
        lastConversationEndAtByPair: { ...state.lastConversationEndAtByPair, [pairKeyValue]: Date.now() },
      }
    }),
  recordAutoLineUsed: (characterId, lineId) =>
    set((state) => {
      const prev = state.recentAutoLineIdsByCharacter[characterId] ?? []
      const next = [...prev, lineId].slice(-RECENT_LINE_HISTORY_SIZE)
      return { recentAutoLineIdsByCharacter: { ...state.recentAutoLineIdsByCharacter, [characterId]: next } }
    }),
  recordDefaultBundleUsed: (pairKeyValue, bundleId) =>
    set((state) => {
      const prev = state.recentDefaultBundleIdsByPair[pairKeyValue] ?? []
      const next = [...prev, bundleId].slice(-RECENT_BUNDLE_HISTORY_SIZE)
      return { recentDefaultBundleIdsByPair: { ...state.recentDefaultBundleIdsByPair, [pairKeyValue]: next } }
    }),
  setActiveBubble: (characterId, text) =>
    set((state) => ({ activeBubbleByCharacter: { ...state.activeBubbleByCharacter, [characterId]: text } })),
  clearActiveBubble: (characterId) =>
    set((state) => {
      const { [characterId]: _removed, ...rest } = state.activeBubbleByCharacter
      return { activeBubbleByCharacter: rest }
    }),
}))
