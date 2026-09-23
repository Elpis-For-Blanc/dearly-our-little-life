import { describe, expect, it } from 'vitest'
import type { BgmTrackDef } from './bgmConfig'
import { indexOfTrack, nextTrack, previousTrack, resolveTracksForBand } from './bgmPlaylist'

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

describe('resolveTracksForBand', () => {
  it('returns the band\'s own tracks, sorted by order', () => {
    const tracks = [
      track({ id: 'm2', band: 'morning', order: 2 }),
      track({ id: 'm1', band: 'morning', order: 1 }),
      track({ id: 'e1', band: 'evening', order: 0 }),
    ]
    expect(resolveTracksForBand(tracks, 'morning').map((t) => t.id)).toEqual(['m1', 'm2'])
  })

  it('excludes disabled tracks', () => {
    const tracks = [track({ id: 'm1', band: 'morning', enabled: false }), track({ id: 'm2', band: 'morning', enabled: true })]
    expect(resolveTracksForBand(tracks, 'morning').map((t) => t.id)).toEqual(['m2'])
  })

  it('falls back to common-band tracks when the requested band has none', () => {
    const tracks = [track({ id: 'c1', band: 'common', order: 0 }), track({ id: 'e1', band: 'evening', order: 0 })]
    expect(resolveTracksForBand(tracks, 'morning').map((t) => t.id)).toEqual(['c1'])
  })

  it('returns an empty array when neither the band nor common has any enabled track — never throws', () => {
    expect(resolveTracksForBand([], 'morning')).toEqual([])
    const tracks = [track({ id: 'e1', band: 'evening' })]
    expect(resolveTracksForBand(tracks, 'morning')).toEqual([])
  })

  it('never uses the common fallback when the band already has its own track(s)', () => {
    const tracks = [track({ id: 'm1', band: 'morning', order: 0 }), track({ id: 'c1', band: 'common', order: 0 })]
    expect(resolveTracksForBand(tracks, 'morning').map((t) => t.id)).toEqual(['m1'])
  })
})

describe('nextTrack / previousTrack', () => {
  it('a single-track playlist loops to itself (spec: 곡이 하나뿐이면 반복 재생)', () => {
    const playlist = [track({ id: 'only' })]
    expect(nextTrack(playlist, 'only')?.id).toBe('only')
    expect(previousTrack(playlist, 'only')?.id).toBe('only')
  })

  it('a multi-track playlist advances in order and wraps at the end', () => {
    const playlist = [track({ id: 'a' }), track({ id: 'b' }), track({ id: 'c' })]
    expect(nextTrack(playlist, 'a')?.id).toBe('b')
    expect(nextTrack(playlist, 'b')?.id).toBe('c')
    expect(nextTrack(playlist, 'c')?.id).toBe('a') // wraps
  })

  it('previous steps backward and wraps at the start', () => {
    const playlist = [track({ id: 'a' }), track({ id: 'b' }), track({ id: 'c' })]
    expect(previousTrack(playlist, 'c')?.id).toBe('b')
    expect(previousTrack(playlist, 'b')?.id).toBe('a')
    expect(previousTrack(playlist, 'a')?.id).toBe('c') // wraps
  })

  it('returns null for an empty playlist', () => {
    expect(nextTrack([], 'anything')).toBeNull()
    expect(previousTrack([], 'anything')).toBeNull()
  })

  it('falls back to the first track when the current id is not (or no longer) in the playlist', () => {
    const playlist = [track({ id: 'a' }), track({ id: 'b' })]
    expect(nextTrack(playlist, 'removed-id')?.id).toBe('a')
    expect(previousTrack(playlist, null)?.id).toBe('a')
  })
})

describe('indexOfTrack', () => {
  it('finds the index of a track by id', () => {
    const playlist = [track({ id: 'a' }), track({ id: 'b' })]
    expect(indexOfTrack(playlist, 'b')).toBe(1)
  })

  it('returns -1 for a null id or an id not present', () => {
    const playlist = [track({ id: 'a' })]
    expect(indexOfTrack(playlist, null)).toBe(-1)
    expect(indexOfTrack(playlist, 'missing')).toBe(-1)
  })
})
