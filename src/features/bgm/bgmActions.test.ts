import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bgmActions } from './bgmActions'
import { bgmAudioElement } from './bgmAudioElement'
import type { BgmTrackDef } from './bgmConfig'
import { DEFAULT_VOLUME, useBgmStore } from './bgmStore'

function track(overrides: Partial<BgmTrackDef> = {}): BgmTrackDef {
  return {
    id: overrides.id ?? 'track',
    title: overrides.title ?? 'Track',
    fileName: overrides.fileName ?? 'track.mp3',
    band: overrides.band ?? 'morning',
    order: overrides.order ?? 0,
    enabled: overrides.enabled ?? true,
  }
}

const MORNING_TRACKS: BgmTrackDef[] = [
  track({ id: 'm1', band: 'morning', order: 0, title: 'Morning 1', fileName: 'm1.mp3' }),
  track({ id: 'm2', band: 'morning', order: 1, title: 'Morning 2', fileName: 'm2.mp3' }),
]

describe('bgmActions', () => {
  beforeEach(() => {
    localStorage.clear()
    useBgmStore.setState({
      volume: DEFAULT_VOLUME,
      muted: false,
      bgmEnabled: true,
      loopEnabled: true,
      isPlaying: false,
      currentBand: null,
      currentTrackId: null,
      errorMessage: null,
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('selectBandStart', () => {
    it('picks the first track of the band and loads it, without playing', () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      expect(useBgmStore.getState().currentBand).toBe('morning')
      expect(useBgmStore.getState().currentTrackId).toBe('m1')
      expect(useBgmStore.getState().isPlaying).toBe(false)
      expect(bgmAudioElement.src).toContain('m1.mp3')
    })

    it('leaves currentTrackId null for an empty catalog, without throwing', () => {
      expect(() => bgmActions.selectBandStart('morning', [])).not.toThrow()
      expect(useBgmStore.getState().currentTrackId).toBeNull()
    })
  })

  describe('play', () => {
    it('does nothing if bgmEnabled is false', async () => {
      useBgmStore.setState({ bgmEnabled: false, currentTrackId: 'm1', currentBand: 'morning' })
      await bgmActions.play()
      expect(useBgmStore.getState().isPlaying).toBe(false)
    })

    it('does nothing if there is no current track (nothing registered for the band)', async () => {
      useBgmStore.setState({ bgmEnabled: true, currentTrackId: null })
      await bgmActions.play()
      expect(useBgmStore.getState().isPlaying).toBe(false)
    })

    it('marks playing and clears any error on success', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      useBgmStore.getState().setError('old error')
      await bgmActions.play()
      expect(useBgmStore.getState().isPlaying).toBe(true)
      expect(useBgmStore.getState().errorMessage).toBeNull()
    })

    it('reports a Korean error and stays paused when the browser rejects playback', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      await bgmActions.play()
      expect(useBgmStore.getState().isPlaying).toBe(false)
      expect(useBgmStore.getState().errorMessage).toMatch(/자동 재생/)
    })

    it('never retries automatically after a failed play — no repeated play() calls from a single action', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      await bgmActions.play()
      expect(playSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('pause', () => {
    it('pauses and marks not-playing', () => {
      useBgmStore.setState({ isPlaying: true })
      bgmActions.pause()
      expect(useBgmStore.getState().isPlaying).toBe(false)
    })
  })

  describe('next / previous', () => {
    it('advances within the current band\'s playlist and keeps playing if it was playing', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      await bgmActions.play()
      await bgmActions.next(MORNING_TRACKS)
      expect(useBgmStore.getState().currentTrackId).toBe('m2')
      expect(useBgmStore.getState().isPlaying).toBe(true)
      expect(bgmAudioElement.src).toContain('m2.mp3')
    })

    it('switches the selected track but does not start playing if it was paused', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      await bgmActions.next(MORNING_TRACKS)
      expect(useBgmStore.getState().currentTrackId).toBe('m2')
      expect(useBgmStore.getState().isPlaying).toBe(false)
    })

    it('previous wraps back to the last track from the first', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      await bgmActions.previous(MORNING_TRACKS)
      expect(useBgmStore.getState().currentTrackId).toBe('m2')
    })

    it('does nothing when there is no current band', async () => {
      await bgmActions.next(MORNING_TRACKS)
      expect(useBgmStore.getState().currentTrackId).toBeNull()
    })
  })

  describe('volume / mute', () => {
    it('setVolume updates the store and (when unmuted) the audio element immediately', () => {
      bgmActions.setVolume(0.3)
      expect(useBgmStore.getState().volume).toBe(0.3)
      expect(bgmAudioElement.volume).toBe(0.3)
    })

    it('setVolume does not change the audible element volume while muted (stays 0)', () => {
      useBgmStore.getState().setMuted(true)
      bgmAudioElement.volume = 0
      bgmActions.setVolume(0.9)
      expect(useBgmStore.getState().volume).toBe(0.9) // stored for when unmuted later
      expect(bgmAudioElement.volume).toBe(0) // but not audible yet
    })

    it('toggleMuted mutes and unmutes, applying to the audio element immediately', () => {
      useBgmStore.getState().setVolume(0.6)
      bgmActions.toggleMuted()
      expect(useBgmStore.getState().muted).toBe(true)
      expect(bgmAudioElement.volume).toBe(0)
      bgmActions.toggleMuted()
      expect(useBgmStore.getState().muted).toBe(false)
      expect(bgmAudioElement.volume).toBe(0.6)
    })
  })

  describe('toggleBgmEnabled', () => {
    it('force-pauses playback when turned off while playing', async () => {
      bgmActions.selectBandStart('morning', MORNING_TRACKS)
      await bgmActions.play()
      expect(useBgmStore.getState().isPlaying).toBe(true)

      bgmActions.toggleBgmEnabled()
      expect(useBgmStore.getState().bgmEnabled).toBe(false)
      expect(useBgmStore.getState().isPlaying).toBe(false)
    })

    it('turning it back on does not auto-play — a manual play() is still required', () => {
      useBgmStore.setState({ bgmEnabled: false })
      bgmActions.toggleBgmEnabled()
      expect(useBgmStore.getState().bgmEnabled).toBe(true)
      expect(useBgmStore.getState().isPlaying).toBe(false)
    })
  })

  describe('toggleLoopEnabled', () => {
    it('flips the persisted loop setting', () => {
      expect(useBgmStore.getState().loopEnabled).toBe(true)
      bgmActions.toggleLoopEnabled()
      expect(useBgmStore.getState().loopEnabled).toBe(false)
    })
  })
})
