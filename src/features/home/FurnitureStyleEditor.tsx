import { useState } from 'react'
import { FURNITURE_COLOR_GROUPS } from './colorPresets'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import {
  defaultPatternSetting,
  FURNITURE_PATTERN_LABELS,
  FURNITURE_PATTERN_ORDER,
  PATTERN_SIZE_LABELS,
  type FurniturePatternType,
  type PatternSetting,
  type PatternSize,
} from './furnitureStyle'
import { resolvePartTones } from './furnitureStyling'
import type { FurnitureDefinition, FurniturePlacement } from './types'

interface FurnitureStyleEditorProps {
  placement: FurniturePlacement
  definition: FurnitureDefinition
  onChange: (patch: Pick<Partial<FurniturePlacement>, 'colors' | 'patterns'>) => void
}

const PATTERN_SIZES: PatternSize[] = [1, 2, 3]

/**
 * Per-part color and per-surface pattern controls for one placed piece. It
 * renders only what `definition.colorParts` / `definition.patternSurfaces`
 * declare, so a table never shows a cushion pattern and a plant (no parts)
 * shows nothing here at all. Every change goes straight to the store, which
 * re-renders the SVG immediately and persists it.
 */
export function FurnitureStyleEditor({ placement, definition, onChange }: FurnitureStyleEditorProps) {
  const { colorParts, patternSurfaces } = definition
  const [partId, setPartId] = useState(colorParts[0]?.id ?? '')
  const [surfaceId, setSurfaceId] = useState(patternSurfaces[0]?.id ?? '')

  if (colorParts.length === 0 && patternSurfaces.length === 0) return null

  const tones = resolvePartTones(placement.furnitureId, placement.colorway, { idPrefix: '', colors: placement.colors })
  const part = colorParts.find((p) => p.id === partId) ?? colorParts[0]
  const surface = patternSurfaces.find((s) => s.id === surfaceId) ?? patternSurfaces[0]
  const pattern = surface ? placement.patterns?.[surface.id] : undefined

  function setPartColor(id: string, hex: string) {
    onChange({ colors: { ...placement.colors, [id]: hex } })
  }

  function resetPartColor(id: string) {
    const { [id]: _removed, ...rest } = placement.colors ?? {}
    onChange({ colors: Object.keys(rest).length > 0 ? rest : undefined })
  }

  function setPattern(id: string, next: PatternSetting | undefined) {
    if (next) {
      onChange({ patterns: { ...placement.patterns, [id]: next } })
      return
    }
    const { [id]: _removed, ...rest } = placement.patterns ?? {}
    onChange({ patterns: Object.keys(rest).length > 0 ? rest : undefined })
  }

  function handlePatternType(type: FurniturePatternType) {
    if (!surface) return
    if (type === 'solid') {
      setPattern(surface.id, undefined)
      return
    }
    // A surface's id is also the id of the part that paints it, so a fresh pattern starts tone-on-tone with that part's current color.
    const tone = tones[surface.id] ?? { fill: '#ffffff', stroke: '#cccccc' }
    setPattern(surface.id, pattern ? { ...pattern, type } : defaultPatternSetting(type, tone))
  }

  return (
    <div className="furniture-style-editor">
      {part && (
        <div className="furniture-properties-field">
          <span>부위별 색상</span>
          <div className="furniture-style-tabs" role="group" aria-label="색상을 바꿀 부위">
            {colorParts.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === part.id ? 'furniture-style-tab furniture-style-tab-active' : 'furniture-style-tab'}
                aria-pressed={p.id === part.id}
                onClick={() => setPartId(p.id)}
              >
                <span className="furniture-style-chip" style={{ backgroundColor: tones[p.id]?.fill }} />
                {p.label}
              </button>
            ))}
          </div>
          <ColorSwatchPicker
            value={tones[part.id]?.fill ?? '#ffffff'}
            onChange={(hex) => setPartColor(part.id, hex)}
            groups={FURNITURE_COLOR_GROUPS}
            label={`${part.label} 색상`}
          />
          {placement.colors?.[part.id] && (
            <button type="button" className="furniture-properties-toggle" onClick={() => resetPartColor(part.id)}>
              {part.label} 기본색으로
            </button>
          )}
        </div>
      )}

      {surface && (
        <div className="furniture-properties-field">
          <span>패턴</span>
          {patternSurfaces.length > 1 && (
            <div className="furniture-style-tabs" role="group" aria-label="패턴을 넣을 표면">
              {patternSurfaces.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={s.id === surface.id ? 'furniture-style-tab furniture-style-tab-active' : 'furniture-style-tab'}
                  aria-pressed={s.id === surface.id}
                  onClick={() => setSurfaceId(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <select aria-label={`${surface.label} 패턴 종류`} value={pattern?.type ?? 'solid'} onChange={(event) => handlePatternType(event.target.value as FurniturePatternType)}>
            {FURNITURE_PATTERN_ORDER.map((type) => (
              <option key={type} value={type}>
                {FURNITURE_PATTERN_LABELS[type]}
              </option>
            ))}
          </select>

          {pattern && (
            <>
              <span className="furniture-style-subtitle">패턴 배경색</span>
              <ColorSwatchPicker
                value={pattern.baseColor}
                onChange={(hex) => setPattern(surface.id, { ...pattern, baseColor: hex })}
                groups={FURNITURE_COLOR_GROUPS}
                label="패턴 배경색"
              />
              <span className="furniture-style-subtitle">패턴 무늬 색상</span>
              <ColorSwatchPicker
                value={pattern.color}
                onChange={(hex) => setPattern(surface.id, { ...pattern, color: hex })}
                groups={FURNITURE_COLOR_GROUPS}
                label="패턴 무늬 색상"
              />
              <span className="furniture-style-subtitle">패턴 크기</span>
              <div className="furniture-style-tabs" role="group" aria-label="패턴 크기">
                {PATTERN_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={size === pattern.size ? 'furniture-style-tab furniture-style-tab-active' : 'furniture-style-tab'}
                    aria-pressed={size === pattern.size}
                    onClick={() => setPattern(surface.id, { ...pattern, size })}
                  >
                    {PATTERN_SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
