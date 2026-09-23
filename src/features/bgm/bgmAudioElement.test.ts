import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bgmAudioElement, cancelFade, fadeVolumeTo, loadTrack, pauseAudio, playAudio, setVolumeImmediate } from './bgmAudioElement'
import { BGM_FADE_STEP_MS } from './bgmConfig'

// jsdom doesn't implement real media playback — HTMLMediaElement.prototype.play/pause/load
// are stubbed here so this module's own logic (not the browser's) is what's under test.
describe('bgmAudioElement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    bgmAudioElement.volume = 1
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('loadTrack', () => {
    it('sets the src, resets playback position, and calls load()', () => {
      const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
      bgmAudioElement.currentTime = 5
      loadTrack('/music/morning.mp3')
      expect(bgmAudioElement.src).toContain('/music/morning.mp3')
      expect(bgmAudioElement.currentTime).toBe(0)
      expect(loadSpy).toHaveBeenCalled()
    })
  })

  describe('playAudio / pauseAudio', () => {
    it('resolves { ok: true } when play() succeeds', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      const result = await playAudio()
      expect(result).toEqual({ ok: true })
    })

    it('resolves { ok: false, errorName } when play() rejects — e.g. the browser blocking autoplay', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      const result = await playAudio()
      expect(result).toEqual({ ok: false, errorName: 'NotAllowedError' })
    })

    it('never throws even if play() rejects with something that is not a DOMException', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('weird failure'))
      const result = await playAudio()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errorName).toBe('UnknownError')
    })

    it('pauseAudio calls the native pause()', () => {
      const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
      pauseAudio()
      expect(pauseSpy).toHaveBeenCalled()
    })
  })

  describe('fadeVolumeTo / cancelFade', () => {
    it('ramps the volume smoothly from the current value to the target over the given duration', async () => {
      bgmAudioElement.volume = 0
      const promise = fadeVolumeTo(1, 200)
      await vi.advanceTimersByTimeAsync(200)
      await promise
      expect(bgmAudioElement.volume).toBeCloseTo(1, 5)
    })

    it('a newer fade supersedes and stops an in-flight older one — no fighting over the volume value', async () => {
      bgmAudioElement.volume = 0
      const firstFade = fadeVolumeTo(1, 400) // slow fade up
      await vi.advanceTimersByTimeAsync(BGM_FADE_STEP_MS * 2) // let it make some progress
      const secondFade = fadeVolumeTo(0.2, 50) // a newer, faster fade to a different target
      await vi.advanceTimersByTimeAsync(50)
      await Promise.all([firstFade, secondFade])
      // Only the second fade's target should have won.
      expect(bgmAudioElement.volume).toBeCloseTo(0.2, 1)
    })

    it('cancelFade stops an in-flight fade from reaching its target', async () => {
      bgmAudioElement.volume = 0
      const promise = fadeVolumeTo(1, 1000)
      await vi.advanceTimersByTimeAsync(BGM_FADE_STEP_MS * 2)
      const volumeAtCancel = bgmAudioElement.volume
      cancelFade()
      await vi.advanceTimersByTimeAsync(1000)
      await promise
      // Volume should have frozen at (roughly) where it was when cancelled, not reached 1.
      expect(bgmAudioElement.volume).toBeCloseTo(volumeAtCancel, 1)
      expect(bgmAudioElement.volume).toBeLessThan(1)
    })
  })

  describe('setVolumeImmediate', () => {
    it('sets volume instantly (no fade) and clamps to [0, 1]', () => {
      setVolumeImmediate(0.5)
      expect(bgmAudioElement.volume).toBe(0.5)
      setVolumeImmediate(2)
      expect(bgmAudioElement.volume).toBe(1)
      setVolumeImmediate(-1)
      expect(bgmAudioElement.volume).toBe(0)
    })

    it('cancels any in-flight fade', async () => {
      bgmAudioElement.volume = 0
      const promise = fadeVolumeTo(1, 1000)
      await vi.advanceTimersByTimeAsync(BGM_FADE_STEP_MS)
      setVolumeImmediate(0.33)
      await vi.advanceTimersByTimeAsync(1000)
      await promise
      expect(bgmAudioElement.volume).toBe(0.33)
    })
  })
})
