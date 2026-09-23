import { useEffect } from 'react'
import { bgmActions, mapPlayErrorToMessage } from './bgmActions'
import { bgmAudioElement, cancelFade, fadeVolumeTo, loadTrack, pauseAudio, playAudio, setVolumeImmediate } from './bgmAudioElement'
import { BGM_FADE_MS, BGM_HOUR_CHECK_INTERVAL_MS, BGM_TRACKS, resolveMusicUrl, type BgmTrackDef, type TimeBand } from './bgmConfig'
import { indexOfTrack, nextTrack, resolveTracksForBand } from './bgmPlaylist'
import { getEffectiveVolume, useBgmStore } from './bgmStore'
import { getCurrentHour, getTimeBand } from './timeBand'

/**
 * Time-band change while actively playing: fade the current track out,
 * swap to the new band's first track, fade the new one in. While paused
 * (or nothing was loaded yet), just updates which track is "ready" for the
 * next manual play — never forces playback back on (spec §4: 일시정지
 * 상태라면 강제로 재생하지 마). Wrapped in try/catch end-to-end (spec §9:
 * "시간대 변경 중 오류" must never crash the interval or leave playback in a
 * broken half-state) — any failure just surfaces as `errorMessage`.
 */
async function handleBandTransition(newBand: TimeBand, tracks: BgmTrackDef[]): Promise<void> {
  try {
    const state = useBgmStore.getState()
    const playlist = resolveTracksForBand(tracks, newBand)
    const track = playlist[0] ?? null

    if (!state.isPlaying) {
      useBgmStore.getState().setCurrentTrack(newBand, track?.id ?? null)
      if (track) loadTrack(resolveMusicUrl(track.fileName))
      return
    }

    await fadeVolumeTo(0, BGM_FADE_MS)

    if (!track) {
      // No track for the new band, and no common fallback either — stop quietly rather than keep the old band's music playing under the wrong band.
      pauseAudio()
      useBgmStore.getState().setPlaying(false)
      useBgmStore.getState().setCurrentTrack(newBand, null)
      return
    }

    useBgmStore.getState().setCurrentTrack(newBand, track.id)
    loadTrack(resolveMusicUrl(track.fileName))
    bgmAudioElement.volume = 0
    const result = await playAudio()
    if (result.ok) {
      useBgmStore.getState().setError(null)
      await fadeVolumeTo(getEffectiveVolume(), BGM_FADE_MS)
    } else {
      useBgmStore.getState().setPlaying(false)
      useBgmStore.getState().setError(mapPlayErrorToMessage(result.errorName))
    }
  } catch {
    cancelFade()
    useBgmStore.getState().setError('시간대 전환 중 문제가 발생했어요.')
  }
}

/** A track finished naturally — advance to the next one in the current band's playlist (wrapping, per loopEnabled), or stop if it was the last one and looping is off. */
async function handleTrackEnded(tracks: BgmTrackDef[]): Promise<void> {
  try {
    const state = useBgmStore.getState()
    if (!state.bgmEnabled || !state.currentBand) return

    const playlist = resolveTracksForBand(tracks, state.currentBand)
    if (playlist.length === 0) return

    const index = indexOfTrack(playlist, state.currentTrackId)
    const isLast = index === playlist.length - 1
    if (isLast && !state.loopEnabled) {
      useBgmStore.getState().setPlaying(false)
      return
    }

    const next = nextTrack(playlist, state.currentTrackId)
    if (!next) return

    useBgmStore.getState().setCurrentTrack(state.currentBand, next.id)
    loadTrack(resolveMusicUrl(next.fileName))
    setVolumeImmediate(getEffectiveVolume())
    const result = await playAudio()
    if (result.ok) {
      useBgmStore.getState().setError(null)
    } else {
      useBgmStore.getState().setPlaying(false)
      useBgmStore.getState().setError(mapPlayErrorToMessage(result.errorName))
    }
  } catch {
    useBgmStore.getState().setError('다음 곡을 재생하지 못했어요.')
  }
}

function handleAudioElementError(): void {
  // Fires for a missing file, a bad filename, a network failure, or a decode error — all "MP3 파일 없음/잘못된 파일명/파일 로딩 실패/디코딩 오류" from spec §9, funneled through the one native event. Never retried automatically.
  useBgmStore.getState().setPlaying(false)
  useBgmStore.getState().setError('음악 파일을 불러오지 못했어요.')
}

/**
 * Mounted exactly once, in `App.tsx` — the common layout that's never
 * unmounted by a phase or room switch — so its interval and the one shared
 * `bgmAudioElement` (module-scoped, see bgmAudioElement.ts) both live for
 * the whole app session regardless of which screen is showing. Owns:
 * the initial time-band detection on load, the periodic real-clock
 * band-change check, and the audio element's `ended`/`error` listeners.
 * Never starts playback itself — see bgmActions.selectBandStart's own doc
 * comment and spec §6 (자동 재생 정책을 우회하지 마).
 */
export function useBgmController(tracks: BgmTrackDef[] = BGM_TRACKS): void {
  useEffect(() => {
    bgmActions.selectBandStart(getTimeBand(getCurrentHour()), tracks)

    function checkBand() {
      const newBand = getTimeBand(getCurrentHour())
      if (newBand === useBgmStore.getState().currentBand) return // unchanged — never reload or restart for no reason
      void handleBandTransition(newBand, tracks)
    }

    const intervalId = window.setInterval(checkBand, BGM_HOUR_CHECK_INTERVAL_MS)

    function onEnded() {
      void handleTrackEnded(tracks)
    }

    bgmAudioElement.addEventListener('ended', onEnded)
    bgmAudioElement.addEventListener('error', handleAudioElementError)

    return () => {
      window.clearInterval(intervalId)
      bgmAudioElement.removeEventListener('ended', onEnded)
      bgmAudioElement.removeEventListener('error', handleAudioElementError)
    }
  }, [tracks])
}
