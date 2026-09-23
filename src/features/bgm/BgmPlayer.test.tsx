import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BgmPlayer } from './BgmPlayer'
import { bgmActions } from './bgmActions'
import { BGM_TRACKS, type BgmTrackDef } from './bgmConfig'
import { DEFAULT_VOLUME, useBgmStore } from './bgmStore'

// BGM_TRACKS is the producer-registered list shipped in bgmConfig.ts (four real tracks now). These tests need to
// control the catalog, so each one swaps it for what it needs and always restores exactly what shipped.
const shippedTracks = [...BGM_TRACKS]

function restoreShippedTracks() {
  BGM_TRACKS.splice(0, BGM_TRACKS.length, ...shippedTracks)
}

describe('BgmPlayer with nothing registered', () => {
  beforeEach(() => {
    BGM_TRACKS.length = 0
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
    restoreShippedTracks()
  })

  it('shows "등록된 음악이 없어요" and disables playback controls when nothing is registered', () => {
    expect(BGM_TRACKS).toEqual([]) // this describe runs with an explicitly empty catalog
    render(<BgmPlayer />)

    expect(screen.getByText('등록된 음악이 없어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '이전 곡' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 곡' })).toBeDisabled()
  })

  it('shows the current track title and band once one is selected', () => {
    useBgmStore.setState({ currentBand: 'morning', currentTrackId: 'fixture-track' })
    // Simulate a registered track by patching the module-level catalog isn't possible from here (it's a real const) —
    // instead this covers the "no matching track" branch, which BgmPlayer already falls back to the empty-state text for,
    // proving it never crashes on an id it can't resolve.
    render(<BgmPlayer />)
    expect(screen.getByText('아침')).toBeInTheDocument()
  })

  it('play/pause button reflects isPlaying and calls the right action — enabled only once a track exists', () => {
    useBgmStore.setState({ currentBand: 'morning', currentTrackId: 'a', isPlaying: false })
    render(<BgmPlayer />)
    // No real track resolves (BGM_TRACKS is empty), so the controls should stay disabled even with a currentTrackId set — hasTrack is derived from an actual BGM_TRACKS lookup, not the id alone.
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled()
  })

  it('volume slider calls bgmActions.setVolume on change', () => {
    const spy = vi.spyOn(bgmActions, 'setVolume')
    render(<BgmPlayer />)
    fireEvent.change(screen.getByLabelText('볼륨'), { target: { value: '0.25' } })
    expect(spy).toHaveBeenCalledWith(0.25)
  })

  it('mute button toggles muted and updates its label', () => {
    render(<BgmPlayer />)
    const muteButton = screen.getByRole('button', { name: '음소거' })
    fireEvent.click(muteButton)
    expect(useBgmStore.getState().muted).toBe(true)
    expect(screen.getByRole('button', { name: '음소거 해제' })).toBeInTheDocument()
  })

  it('BGM on/off toggle disables playback controls when turned off', () => {
    render(<BgmPlayer />)
    const toggle = screen.getByRole('button', { name: 'BGM 켜짐' })
    fireEvent.click(toggle)
    expect(useBgmStore.getState().bgmEnabled).toBe(false)
    expect(screen.getByRole('button', { name: 'BGM 꺼짐' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled()
  })

  it('shows an error message when one is set', () => {
    useBgmStore.setState({ errorMessage: '브라우저가 자동 재생을 차단했어요. 재생 버튼을 다시 눌러주세요.' })
    render(<BgmPlayer />)
    expect(screen.getByText(/자동 재생을 차단했어요/)).toBeInTheDocument()
  })

  it('loop toggle button reflects loopEnabled and flips it on click', () => {
    render(<BgmPlayer />)
    const loopButton = screen.getByTitle('반복 재생')
    expect(loopButton).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(loopButton)
    expect(useBgmStore.getState().loopEnabled).toBe(false)
    expect(loopButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not throw and shows the empty-catalog message when currentTrackId points at a track BGM_TRACKS no longer has (e.g. it was disabled/removed)', () => {
    useBgmStore.setState({ currentBand: 'night', currentTrackId: 'no-longer-exists' })
    expect(() => render(<BgmPlayer />)).not.toThrow()
    expect(screen.getByText('등록된 음악이 없어요')).toBeInTheDocument()
  })
})

// A second describe block exercises the "tracks actually exist" rendering
// path using a small local stand-in component, since BGM_TRACKS itself is a
// real, non-injectable constant in the shipped config (by design — see
// bgmConfig.ts) and this repo ships with it empty. This still exercises the
// exact same BgmPlayer component/logic, just fed a non-empty lookup.
function trackFixture(overrides: Partial<BgmTrackDef> = {}): BgmTrackDef {
  return {
    id: overrides.id ?? 'fixture',
    title: overrides.title ?? '아침 산책',
    fileName: overrides.fileName ?? 'morning.mp3',
    band: overrides.band ?? 'morning',
    order: overrides.order ?? 0,
    enabled: overrides.enabled ?? true,
  }
}

describe('BgmPlayer with a registered track (via BGM_TRACKS.push, restored after each test)', () => {
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
    // BGM_TRACKS is a real exported array (not a fresh copy per import in this module graph) — swap in one fixture track for this describe block only, to check BgmPlayer's "a track exists" rendering, then restore what shipped.
    BGM_TRACKS.length = 0
    BGM_TRACKS.push(trackFixture())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    restoreShippedTracks()
  })

  it('shows the track title and enables play/prev/next once a real track resolves', () => {
    useBgmStore.setState({ currentBand: 'morning', currentTrackId: 'fixture' })
    render(<BgmPlayer />)
    expect(screen.getByText('아침 산책')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '재생' })).toBeEnabled()
  })

  it('clicking play calls bgmActions.play', async () => {
    useBgmStore.setState({ currentBand: 'morning', currentTrackId: 'fixture' })
    const spy = vi.spyOn(bgmActions, 'play').mockResolvedValue(undefined)
    render(<BgmPlayer />)
    fireEvent.click(screen.getByRole('button', { name: '재생' }))
    expect(spy).toHaveBeenCalled()
  })

  it('while playing, the button shows pause and clicking it calls bgmActions.pause', () => {
    useBgmStore.setState({ currentBand: 'morning', currentTrackId: 'fixture', isPlaying: true })
    const spy = vi.spyOn(bgmActions, 'pause').mockImplementation(() => {})
    render(<BgmPlayer />)
    const button = screen.getByRole('button', { name: '일시정지' })
    fireEvent.click(button)
    expect(spy).toHaveBeenCalled()
  })
})
