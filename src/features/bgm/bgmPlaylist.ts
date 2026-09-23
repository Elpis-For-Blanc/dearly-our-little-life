import type { BgmTrackDef, TimeBand } from './bgmConfig'

/**
 * Resolves the ordered, enabled track list for a given time band: the
 * band's own tracks (sorted by `order`) if any exist, otherwise the
 * `'common'`-band tracks as a fallback, otherwise an empty array — which
 * every caller (the controller, the player UI) must treat as "stay
 * silent", never as an error.
 */
export function resolveTracksForBand(tracks: BgmTrackDef[], band: TimeBand): BgmTrackDef[] {
  const forBand = tracks.filter((t) => t.enabled && t.band === band).sort((a, b) => a.order - b.order)
  if (forBand.length > 0) return forBand

  const common = tracks.filter((t) => t.enabled && t.band === 'common').sort((a, b) => a.order - b.order)
  return common
}

/** Index of `trackId` within `playlist`, or -1 if it's not there (e.g. it was disabled/removed since it started playing). */
export function indexOfTrack(playlist: BgmTrackDef[], trackId: string | null): number {
  if (!trackId) return -1
  return playlist.findIndex((t) => t.id === trackId)
}

/**
 * Next track after `currentTrackId` in `playlist`, wrapping back to the
 * start — this is what makes a single-track band "loop" (next-of-the-only-
 * track is itself) and a multi-track band cycle through in order, per the
 * spec's §3 (곡 하나면 반복, 여럿이면 순서대로) without needing separate logic
 * for either case.
 */
export function nextTrack(playlist: BgmTrackDef[], currentTrackId: string | null): BgmTrackDef | null {
  if (playlist.length === 0) return null
  const index = indexOfTrack(playlist, currentTrackId)
  if (index === -1) return playlist[0]
  return playlist[(index + 1) % playlist.length]
}

/** Previous track before `currentTrackId` in `playlist`, wrapping to the end. */
export function previousTrack(playlist: BgmTrackDef[], currentTrackId: string | null): BgmTrackDef | null {
  if (playlist.length === 0) return null
  const index = indexOfTrack(playlist, currentTrackId)
  if (index === -1) return playlist[0]
  return playlist[(index - 1 + playlist.length) % playlist.length]
}
