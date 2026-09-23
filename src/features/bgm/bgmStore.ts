import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TimeBand } from './bgmConfig'

export const DEFAULT_VOLUME = 0.6

/**
 * Pure state only — this store never touches `bgmAudioElement.ts` itself.
 * `useBgmController.ts` is the one place that reads/writes both this store
 * and the actual `<audio>` element together, same separation this codebase
 * already uses elsewhere (e.g. `characterMovementStore.ts` is pure state,
 * `useCharacterMovementSimulation.ts` is the orchestration layer).
 */
interface BgmState {
  // --- persisted user settings (localStorage, key 'dearly-bgm') ---
  volume: number
  muted: boolean
  /** Master on/off switch — distinct from `isPlaying`. Turning this off is a stronger "I don't want BGM" than pausing; the player's play button stays disabled while it's off. */
  bgmEnabled: boolean
  /** Whether playback wraps back to the first track once it plays through the current band's whole list (or repeats the single track in a single-track band) instead of stopping. Default on, matching the spec's default described playback behavior. */
  loopEnabled: boolean

  // --- ephemeral playback state (never persisted — always starts fresh, per spec §6: 새로고침 후 정지 상태로 시작) ---
  isPlaying: boolean
  currentBand: TimeBand | null
  currentTrackId: string | null
  /** A short, user-facing message for the last playback failure (blocked autoplay, missing file, decode error, ...) — cleared on the next successful action. Never drives a retry loop by itself. */
  errorMessage: string | null

  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setBgmEnabled: (enabled: boolean) => void
  setLoopEnabled: (enabled: boolean) => void
  setPlaying: (isPlaying: boolean) => void
  setCurrentTrack: (band: TimeBand | null, trackId: string | null) => void
  setError: (message: string | null) => void
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
}

export const useBgmStore = create<BgmState>()(
  persist(
    (set) => ({
      volume: DEFAULT_VOLUME,
      muted: false,
      bgmEnabled: true,
      loopEnabled: true,

      isPlaying: false,
      currentBand: null,
      currentTrackId: null,
      errorMessage: null,

      setVolume: (volume) => set({ volume: clamp01(volume) }),
      setMuted: (muted) => set({ muted }),
      setBgmEnabled: (enabled) => set({ bgmEnabled: enabled }),
      setLoopEnabled: (enabled) => set({ loopEnabled: enabled }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setCurrentTrack: (band, trackId) => set({ currentBand: band, currentTrackId: trackId }),
      setError: (message) => set({ errorMessage: message }),
    }),
    {
      name: 'dearly-bgm',
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        bgmEnabled: state.bgmEnabled,
        loopEnabled: state.loopEnabled,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Pick<BgmState, 'volume' | 'muted' | 'bgmEnabled' | 'loopEnabled'>> | undefined
        return {
          ...currentState,
          volume: typeof persisted?.volume === 'number' ? clamp01(persisted.volume) : currentState.volume,
          muted: typeof persisted?.muted === 'boolean' ? persisted.muted : currentState.muted,
          bgmEnabled: typeof persisted?.bgmEnabled === 'boolean' ? persisted.bgmEnabled : currentState.bgmEnabled,
          loopEnabled: typeof persisted?.loopEnabled === 'boolean' ? persisted.loopEnabled : currentState.loopEnabled,
        }
      },
    },
  ),
)

/** The volume that should actually reach the speakers right now — 0 while muted, `volume` otherwise. Shared so bgmActions.ts/useBgmController.ts never each re-derive this slightly differently. */
export function getEffectiveVolume(): number {
  const { volume, muted } = useBgmStore.getState()
  return muted ? 0 : volume
}
