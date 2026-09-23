import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_VOLUME, getEffectiveVolume, useBgmStore } from './bgmStore'

describe('bgmStore', () => {
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
  })

  it('starts paused, with no current band/track — never auto-playing on load (spec §6)', () => {
    const initial = useBgmStore.getInitialState()
    expect(initial.isPlaying).toBe(false)
    expect(initial.currentBand).toBeNull()
    expect(initial.currentTrackId).toBeNull()
  })

  it('setVolume clamps to [0, 1]', () => {
    useBgmStore.getState().setVolume(1.5)
    expect(useBgmStore.getState().volume).toBe(1)
    useBgmStore.getState().setVolume(-0.5)
    expect(useBgmStore.getState().volume).toBe(0)
    useBgmStore.getState().setVolume(0.42)
    expect(useBgmStore.getState().volume).toBe(0.42)
  })

  it('getEffectiveVolume is 0 while muted regardless of the stored volume', () => {
    useBgmStore.getState().setVolume(0.8)
    expect(getEffectiveVolume()).toBe(0.8)
    useBgmStore.getState().setMuted(true)
    expect(getEffectiveVolume()).toBe(0)
  })

  it('persists volume/muted/bgmEnabled/loopEnabled, but never the ephemeral playback fields', () => {
    useBgmStore.getState().setVolume(0.3)
    useBgmStore.getState().setMuted(true)
    useBgmStore.getState().setBgmEnabled(false)
    useBgmStore.getState().setLoopEnabled(false)
    useBgmStore.getState().setPlaying(true)
    useBgmStore.getState().setCurrentTrack('morning', 'some-track')

    const stored = JSON.parse(localStorage.getItem('dearly-bgm') ?? '{}')
    expect(stored.state).toMatchObject({ volume: 0.3, muted: true, bgmEnabled: false, loopEnabled: false })
    expect(stored.state).not.toHaveProperty('isPlaying')
    expect(stored.state).not.toHaveProperty('currentBand')
    expect(stored.state).not.toHaveProperty('currentTrackId')
  })

  it('merge falls back to safe defaults for missing or corrupted persisted fields', () => {
    const merge = useBgmStore.persist.getOptions().merge!
    const merged = merge({ volume: 'not-a-number', muted: 'yes' }, useBgmStore.getState()) as ReturnType<typeof useBgmStore.getState>
    expect(merged.volume).toBe(useBgmStore.getState().volume)
    expect(merged.muted).toBe(useBgmStore.getState().muted)
  })

  it('merge accepts valid persisted values', () => {
    const merge = useBgmStore.persist.getOptions().merge!
    const merged = merge(
      { volume: 0.77, muted: true, bgmEnabled: false, loopEnabled: false },
      useBgmStore.getState(),
    ) as ReturnType<typeof useBgmStore.getState>
    expect(merged.volume).toBe(0.77)
    expect(merged.muted).toBe(true)
    expect(merged.bgmEnabled).toBe(false)
    expect(merged.loopEnabled).toBe(false)
  })

  it('merge is resilient to completely missing persisted state (first-ever visit)', () => {
    const merge = useBgmStore.persist.getOptions().merge!
    const merged = merge(undefined, useBgmStore.getState()) as ReturnType<typeof useBgmStore.getState>
    expect(merged.volume).toBe(DEFAULT_VOLUME)
    expect(merged.muted).toBe(false)
    expect(merged.bgmEnabled).toBe(true)
    expect(merged.loopEnabled).toBe(true)
  })

  it('setError stores and clears a user-facing message', () => {
    useBgmStore.getState().setError('문제가 발생했어요.')
    expect(useBgmStore.getState().errorMessage).toBe('문제가 발생했어요.')
    useBgmStore.getState().setError(null)
    expect(useBgmStore.getState().errorMessage).toBeNull()
  })
})
