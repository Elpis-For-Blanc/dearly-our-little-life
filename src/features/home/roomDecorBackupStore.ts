import { create } from 'zustand'
import type { FloorSettings, WallpaperSettings } from './roomSurface'
import type { FurniturePlacement } from './types'

export interface RoomDecorBackup {
  wallpaper: WallpaperSettings
  floor: FloorSettings
  furniture: FurniturePlacement[]
  savedAt: number
}

/**
 * A one-step "되돌리기" safety net for applying a room decor preset —
 * ephemeral, session-only, deliberately **not** persisted (no `persist`
 * middleware), same rationale as `dialogueStore`/`furnitureUsageStore`/
 * `autoFurnitureUseStore`: this is a temporary undo buffer, never real save
 * data, so a reload always comes back with nothing to revert. Keyed per room
 * id so backing up one room never touches another's.
 *
 * Only the *most recent* backup per room is kept — `save` overwrites
 * whatever was there before, and a successful revert clears it — so this is
 * a single step back to "right before the last preset was applied," not a
 * multi-level undo history. `DecorPresetPanel.tsx` discloses this scope
 * ("직전 상태로 한 번만 되돌릴 수 있어요, 새로고침하면 사라져요") directly
 * in the UI, per the spec's "백업과 되돌리기의 범위 및 유지 기간을 UI에
 * 명확하게 안내해 줘".
 */
interface RoomDecorBackupState {
  byRoomId: Record<string, RoomDecorBackup>
  save: (roomId: string, backup: RoomDecorBackup) => void
  clear: (roomId: string) => void
  reset: () => void
}

export const useRoomDecorBackupStore = create<RoomDecorBackupState>((set) => ({
  byRoomId: {},
  save: (roomId, backup) => set((state) => ({ byRoomId: { ...state.byRoomId, [roomId]: backup } })),
  clear: (roomId) =>
    set((state) => {
      if (!(roomId in state.byRoomId)) return state
      const { [roomId]: _removed, ...rest } = state.byRoomId
      return { byRoomId: rest }
    }),
  reset: () => set({ byRoomId: {} }),
}))
