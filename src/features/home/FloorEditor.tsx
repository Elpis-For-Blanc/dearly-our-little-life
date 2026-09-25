import { ColorSwatchPicker } from './ColorSwatchPicker'
import { FURNITURE_COLOR_GROUPS } from './colorPresets'
import { getActiveDecorateRoom, useHomeStore } from './homeStore'
import { getFloorPatternContent } from './patterns/floorPatterns'
import { FLOOR_PATTERN_LABELS, FLOOR_PATTERN_ORDER } from './roomSurface'

const PREVIEW_TILE = 40

/** Applies immediately — every control here writes straight to homeStore (the active decorate room), which Room.tsx renders reactively. */
export function FloorEditor() {
  const floor = useHomeStore((state) => getActiveDecorateRoom(state).floor)
  const setFloor = useHomeStore((state) => state.setFloor)

  return (
    <div className="surface-editor">
      <h3>바닥 색상</h3>
      <ColorSwatchPicker value={floor.baseColor} onChange={(hex) => setFloor({ baseColor: hex })} groups={FURNITURE_COLOR_GROUPS} label="바닥 색상" />

      <h3>패턴</h3>
      <div className="pattern-grid">
        {FLOOR_PATTERN_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={floor.pattern === type}
            className={floor.pattern === type ? 'pattern-swatch pattern-swatch-selected' : 'pattern-swatch'}
            onClick={() => setFloor({ pattern: type })}
          >
            <svg viewBox={`0 0 ${PREVIEW_TILE} ${PREVIEW_TILE}`} width="100%" height="100%">
              <rect width={PREVIEW_TILE} height={PREVIEW_TILE} fill={floor.baseColor} />
              {getFloorPatternContent(type, PREVIEW_TILE, floor.patternColor)}
            </svg>
            <span>{FLOOR_PATTERN_LABELS[type]}</span>
          </button>
        ))}
      </div>

      {floor.pattern !== 'solid' && (
        <>
          <h3>무늬 색상</h3>
          <ColorSwatchPicker value={floor.patternColor} onChange={(hex) => setFloor({ patternColor: hex })} groups={FURNITURE_COLOR_GROUPS} label="바닥 무늬 색상" />

          <label className="surface-editor-field">
            <span>패턴 크기 ({Math.round(floor.patternScale * 100)}%)</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={floor.patternScale}
              onChange={(event) => setFloor({ patternScale: Number(event.target.value) })}
            />
          </label>

          <label className="surface-editor-field">
            <span>패턴 방향 ({floor.orientation}°)</span>
            <input
              type="range"
              min={0}
              max={180}
              step={15}
              value={floor.orientation}
              onChange={(event) => setFloor({ orientation: Number(event.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  )
}
