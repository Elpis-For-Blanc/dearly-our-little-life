import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ROOM_LIGHTING_INTENSITY } from './roomLightingConfig'

interface RoomLightingSettingsState {
  /** Master on/off for the whole time-of-day lighting effect. Default **off** — existing users must see no visual change until they explicitly opt in. */
  enabled: boolean
  /** 0-100. How strongly the current time band's tint applies — see `roomLightingEngine.ts`'s `getRoomLightingStyle`. */
  intensity: number
  setEnabled: (enabled: boolean) => void
  setIntensity: (intensity: number) => void
}

function clampIntensity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ROOM_LIGHTING_INTENSITY
  return Math.min(100, Math.max(0, value))
}

function normalizeEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

/**
 * Persisted separately from every other setting (`localStorage` key
 * `dearly-room-lighting`) — mirrors `autoFurnitureUseSettingsStore.ts`'s own
 * persisted-setting-only pattern (a small, standalone store, nothing about
 * `homeStore`'s schema touched). "자동 조명 해제 시 원래 방 색상 복귀" needs
 * no separate code path: `RoomLightingOverlay.tsx` renders nothing at all
 * while `enabled` is false, so the room's own unmodified wallpaper/floor/
 * furniture rendering underneath is always exactly what shows.
 */
export const useRoomLightingSettingsStore = create<RoomLightingSettingsState>()(
  persist(
    (set) => ({
      enabled: false,
      intensity: DEFAULT_ROOM_LIGHTING_INTENSITY,
      setEnabled: (enabled) => set({ enabled }),
      setIntensity: (intensity) => set({ intensity: clampIntensity(intensity) }),
    }),
    {
      name: 'dearly-room-lighting',
      partialize: (state) => ({ enabled: state.enabled, intensity: state.intensity }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<RoomLightingSettingsState> | undefined
        return { ...currentState, enabled: normalizeEnabled(persisted?.enabled), intensity: clampIntensity(persisted?.intensity) }
      },
    },
  ),
)
