import { loadTrack, pauseAudio, playAudio, setVolumeImmediate, type PlayAttemptResult } from './bgmAudioElement'
import { BGM_TRACKS, resolveMusicUrl, type BgmTrackDef, type TimeBand } from './bgmConfig'
import { nextTrack, previousTrack, resolveTracksForBand } from './bgmPlaylist'
import { getEffectiveVolume, useBgmStore } from './bgmStore'

/** Korean, user-facing translation of a rejected play attempt — kept here (not in bgmAudioElement.ts, which stays UI-text-free) since it's the one place both bgmActions.ts and useBgmController.ts need it. */
export function mapPlayErrorToMessage(errorName: string): string {
  if (errorName === 'NotAllowedError') return '브라우저가 자동 재생을 차단했어요. 재생 버튼을 다시 눌러주세요.'
  if (errorName === 'NotSupportedError') return '이 음악 파일을 재생할 수 없어요.'
  if (errorName === 'AbortError') return '재생이 중단되었어요.'
  return '음악을 재생하지 못했어요.'
}

function applyPlayResult(result: PlayAttemptResult) {
  if (result.ok) {
    useBgmStore.getState().setPlaying(true)
    useBgmStore.getState().setError(null)
  } else {
    useBgmStore.getState().setPlaying(false)
    useBgmStore.getState().setError(mapPlayErrorToMessage(result.errorName))
  }
}

/**
 * Loads (without playing) whichever track is first in `band`'s resolved
 * playlist, updating the store's currentBand/currentTrackId. Safe with an
 * empty catalog — currentTrackId simply becomes null, and the player UI is
 * responsible for showing "등록된 음악이 없어요" in that case. `tracks`
 * defaults to the real producer-edited catalog; tests pass a small fixture
 * instead (same pattern `dialogue/autoDialogueEngine.ts`'s
 * `defaultBundleCatalog` param already uses).
 */
function selectBandStart(band: TimeBand, tracks: BgmTrackDef[] = BGM_TRACKS): void {
  const playlist = resolveTracksForBand(tracks, band)
  const track = playlist[0] ?? null
  useBgmStore.getState().setCurrentTrack(band, track?.id ?? null)
  if (track) loadTrack(resolveMusicUrl(track.fileName))
}

async function switchWithin(pick: typeof nextTrack, tracks: BgmTrackDef[]): Promise<void> {
  const state = useBgmStore.getState()
  if (!state.currentBand) return
  const playlist = resolveTracksForBand(tracks, state.currentBand)
  const track = pick(playlist, state.currentTrackId)
  if (!track) return

  const wasPlaying = state.isPlaying
  useBgmStore.getState().setCurrentTrack(state.currentBand, track.id)
  loadTrack(resolveMusicUrl(track.fileName))
  if (wasPlaying) {
    setVolumeImmediate(getEffectiveVolume())
    applyPlayResult(await playAudio())
  }
}

/**
 * Plain imperative actions — not a hook, since none of them need component
 * lifecycle; they read/write `bgmStore` and `bgmAudioElement` directly,
 * same pattern `dialogue/autoDialogueTrigger.ts` already uses for its
 * store-driven actions. `BgmPlayer.tsx` calls these from click handlers;
 * `useBgmController.ts` (the mount-once hook that owns the hour-check timer
 * and audio element event listeners) calls `selectBandStart` too, at
 * startup and on every detected band change.
 */
export const bgmActions = {
  selectBandStart,

  async play() {
    const state = useBgmStore.getState()
    if (!state.bgmEnabled) return
    if (!state.currentTrackId) return // nothing registered for the current band, and no common fallback either

    setVolumeImmediate(getEffectiveVolume())
    applyPlayResult(await playAudio())
  },

  pause() {
    pauseAudio()
    useBgmStore.getState().setPlaying(false)
  },

  next(tracks: BgmTrackDef[] = BGM_TRACKS) {
    return switchWithin(nextTrack, tracks)
  },

  previous(tracks: BgmTrackDef[] = BGM_TRACKS) {
    return switchWithin(previousTrack, tracks)
  },

  setVolume(volume: number) {
    useBgmStore.getState().setVolume(volume)
    if (!useBgmStore.getState().muted) setVolumeImmediate(useBgmStore.getState().volume)
  },

  toggleMuted() {
    const next = !useBgmStore.getState().muted
    useBgmStore.getState().setMuted(next)
    setVolumeImmediate(next ? 0 : useBgmStore.getState().volume)
  },

  toggleBgmEnabled() {
    const next = !useBgmStore.getState().bgmEnabled
    useBgmStore.getState().setBgmEnabled(next)
    if (!next && useBgmStore.getState().isPlaying) {
      pauseAudio()
      useBgmStore.getState().setPlaying(false)
    }
  },

  toggleLoopEnabled() {
    useBgmStore.getState().setLoopEnabled(!useBgmStore.getState().loopEnabled)
  },
}
