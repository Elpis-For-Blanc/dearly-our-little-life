import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook } from '@testing-library/react'
import { bgmActions } from './bgmActions'
import { bgmAudioElement } from './bgmAudioElement'
import { BGM_FADE_MS, BGM_HOUR_CHECK_INTERVAL_MS, type BgmTrackDef } from './bgmConfig'
import { DEFAULT_VOLUME, useBgmStore } from './bgmStore'
import { useBgmController } from './useBgmController'

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

const TRACKS: BgmTrackDef[] = [
  track({ id: 'morning-1', band: 'morning', order: 0, fileName: 'morning1.mp3' }),
  track({ id: 'daytime-1', band: 'daytime', order: 0, fileName: 'daytime1.mp3' }),
  track({ id: 'daytime-2', band: 'daytime', order: 1, fileName: 'daytime2.mp3' }),
]

function mockHour(hour: number) {
  vi.setSystemTime(new Date(2026, 0, 1, hour, 0, 0))
}

describe('useBgmController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('detects the initial time band on mount and selects (but does not play) its first track', () => {
    mockHour(8) // morning
    renderHook(() => useBgmController(TRACKS))
    expect(useBgmStore.getState().currentBand).toBe('morning')
    expect(useBgmStore.getState().currentTrackId).toBe('morning-1')
    expect(useBgmStore.getState().isPlaying).toBe(false)
  })

  it('auto-switches to the new band\'s music while actively playing when the real-clock hour crosses a boundary', async () => {
    mockHour(10) // morning, 10:xx
    renderHook(() => useBgmController(TRACKS))
    await bgmActions.play()
    expect(useBgmStore.getState().isPlaying).toBe(true)

    mockHour(11) // now daytime
    await vi.advanceTimersByTimeAsync(BGM_HOUR_CHECK_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(BGM_FADE_MS * 3) // let the fade-out/swap/fade-in chain the transition kicks off actually finish

    expect(useBgmStore.getState().currentBand).toBe('daytime')
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-1')
    expect(useBgmStore.getState().isPlaying).toBe(true)
  })

  it('while paused, a band change only updates which track is "ready" — it never force-starts playback', async () => {
    mockHour(10)
    renderHook(() => useBgmController(TRACKS))
    expect(useBgmStore.getState().isPlaying).toBe(false)

    mockHour(11)
    await vi.advanceTimersByTimeAsync(BGM_HOUR_CHECK_INTERVAL_MS)

    expect(useBgmStore.getState().currentBand).toBe('daytime')
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-1')
    expect(useBgmStore.getState().isPlaying).toBe(false) // still paused — the user must press play again
  })

  it('never reloads or restarts when the band has not actually changed', async () => {
    mockHour(8)
    renderHook(() => useBgmController(TRACKS))
    await bgmActions.play()
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load')
    loadSpy.mockClear() // vi.spyOn on an already-spied method (see beforeEach) returns the same mock — clear the mount-time load() call recorded before this point

    mockHour(9) // still morning
    await vi.advanceTimersByTimeAsync(BGM_HOUR_CHECK_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(BGM_HOUR_CHECK_INTERVAL_MS)

    expect(loadSpy).not.toHaveBeenCalled()
    expect(useBgmStore.getState().currentTrackId).toBe('morning-1')
  })

  it('stops quietly (no error) when the new band has no track and no common fallback, while previously playing', async () => {
    mockHour(8) // morning has a track
    renderHook(() => useBgmController(TRACKS))
    await bgmActions.play()

    mockHour(21) // night — not in TRACKS, no 'common' fallback either
    await vi.advanceTimersByTimeAsync(BGM_HOUR_CHECK_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(BGM_FADE_MS * 3)

    expect(useBgmStore.getState().isPlaying).toBe(false)
    expect(useBgmStore.getState().currentTrackId).toBeNull()
    expect(useBgmStore.getState().errorMessage).toBeNull()
  })

  it('advances to the next track in the band when one finishes naturally (loopEnabled true wraps back to the start)', async () => {
    mockHour(12) // daytime — 2 tracks
    renderHook(() => useBgmController(TRACKS))
    await bgmActions.play()
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-1')

    bgmAudioElement.dispatchEvent(new Event('ended'))
    await vi.advanceTimersByTimeAsync(0)
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-2')

    bgmAudioElement.dispatchEvent(new Event('ended'))
    await vi.advanceTimersByTimeAsync(0)
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-1') // wrapped
    expect(useBgmStore.getState().isPlaying).toBe(true)
  })

  it('stops after the last track when loopEnabled is false, instead of wrapping', async () => {
    mockHour(12)
    renderHook(() => useBgmController(TRACKS))
    useBgmStore.getState().setLoopEnabled(false)
    await bgmActions.play()

    bgmAudioElement.dispatchEvent(new Event('ended')) // daytime-1 -> daytime-2
    await vi.advanceTimersByTimeAsync(0)
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-2')

    bgmAudioElement.dispatchEvent(new Event('ended')) // daytime-2 was last — should stop, not wrap
    await vi.advanceTimersByTimeAsync(0)
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-2')
    expect(useBgmStore.getState().isPlaying).toBe(false)
  })

  it('a single-track band loops the same track when it ends', async () => {
    mockHour(8)
    renderHook(() => useBgmController(TRACKS))
    await bgmActions.play()
    expect(useBgmStore.getState().currentTrackId).toBe('morning-1')

    bgmAudioElement.dispatchEvent(new Event('ended'))
    await vi.advanceTimersByTimeAsync(0)
    expect(useBgmStore.getState().currentTrackId).toBe('morning-1')
    expect(useBgmStore.getState().isPlaying).toBe(true)
  })

  it('the audio element\'s native error event surfaces a user-facing message and stops playback, without retrying', async () => {
    mockHour(8)
    renderHook(() => useBgmController(TRACKS))
    await bgmActions.play()

    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play')
    playSpy.mockClear()
    bgmAudioElement.dispatchEvent(new Event('error'))

    expect(useBgmStore.getState().isPlaying).toBe(false)
    expect(useBgmStore.getState().errorMessage).toBeTruthy()
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('mounting the controller multiple times (simulating React StrictMode\'s dev-mode double-invoke) never creates a second audio element or starts a second playback', () => {
    mockHour(8)
    const first = renderHook(() => useBgmController(TRACKS))
    const elementAfterFirstMount = bgmAudioElement
    first.unmount()
    const second = renderHook(() => useBgmController(TRACKS))
    expect(bgmAudioElement).toBe(elementAfterFirstMount) // same module-level singleton, never recreated
    second.unmount()
  })

  it('mounting the controller inside React.StrictMode does not register duplicate ended/error listeners (no double track-advance per single "ended" event)', async () => {
    mockHour(12)
    function Harness() {
      useBgmController(TRACKS)
      return null
    }
    const { StrictMode } = await import('react')
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )
    await bgmActions.play()
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-1')

    bgmAudioElement.dispatchEvent(new Event('ended'))
    await vi.advanceTimersByTimeAsync(0)
    // If listeners were double-registered, this single 'ended' event would advance two steps (daytime-1 -> daytime-2 -> daytime-1) instead of one.
    expect(useBgmStore.getState().currentTrackId).toBe('daytime-2')
  })
})
