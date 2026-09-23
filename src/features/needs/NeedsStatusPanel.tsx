import { useEffect } from 'react'
import { deriveMood, MOOD_LABELS } from './moodEngine'
import { createDefaultNeeds } from './needsConfig'
import { useNeedsStore } from './needsStore'
import './NeedsStatusPanel.css'

interface NeedGaugeSpec {
  key: 'hunger' | 'energy' | 'fun' | 'social'
  label: string
}

const GAUGES: NeedGaugeSpec[] = [
  { key: 'hunger', label: '배고픔' },
  { key: 'energy', label: '기력' },
  { key: 'fun', label: '즐거움' },
  { key: 'social', label: '교류' },
]

interface NeedsStatusPanelProps {
  characterId: string
}

/**
 * A small "상태" section: four simple gauges plus one mood line — no
 * numbers-heavy HUD, matching DEARLY's soft, everyday-life tone rather than
 * a game stat screen. Reads live from `needsStore`; mood is always
 * recomputed here (`deriveMood`), never read from any stored field.
 *
 * Self-heals a character with no needs entry yet (e.g. one registered
 * before this feature existed, or opened before the movement tick's own
 * defensive `ensureCharacter` has had a chance to run) via the same
 * `ensureCharacter` call `CharacterForm.tsx`'s registration handler and
 * `needsTrigger.ts`'s tick pass already use — never a second, different
 * default-creation path.
 */
export function NeedsStatusPanel({ characterId }: NeedsStatusPanelProps) {
  const needs = useNeedsStore((state) => state.byId[characterId])
  const ensureCharacter = useNeedsStore((state) => state.ensureCharacter)

  useEffect(() => {
    ensureCharacter(characterId)
  }, [characterId, ensureCharacter])

  // Falls back to a plain default-shaped display for the one render before the effect above lands the real entry —
  // never blank, never a loading spinner, for a section this lightweight.
  const displayNeeds = needs ?? createDefaultNeeds(() => 0.5)
  const mood = deriveMood(displayNeeds)

  return (
    <div className="needs-status-panel">
      <h3 className="needs-status-title">상태</h3>
      {GAUGES.map((gauge) => (
        <div key={gauge.key} className="needs-status-gauge">
          <span className="needs-status-gauge-label">{gauge.label}</span>
          <div className="needs-status-gauge-track" role="progressbar" aria-label={gauge.label} aria-valuenow={Math.round(displayNeeds[gauge.key])} aria-valuemin={0} aria-valuemax={100}>
            <div className="needs-status-gauge-fill" style={{ width: `${displayNeeds[gauge.key]}%` }} />
          </div>
        </div>
      ))}
      <p className="needs-status-mood">기분: {MOOD_LABELS[mood]}</p>
    </div>
  )
}
