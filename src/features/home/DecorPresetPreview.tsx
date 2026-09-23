import { useMemo, type CSSProperties } from 'react'
import { getFurnitureDefinition, getFurnitureSize } from './furnitureCatalog'
import { FloorSurface } from './FloorSurface'
import type { DecorPresetDefinition } from './decorPresets'
import { resolveDecorPresetFurniture } from './decorPresetEngine'
import { FurnitureIcon } from './illustrations'
import { FLOOR_HEIGHT_RATIO, ROOM_HEIGHT, ROOM_WIDTH } from './roomLayout'
import { WallSurface } from './WallSurface'
import './DecorPresetPreview.css'

interface DecorPresetPreviewProps {
  preset: DecorPresetDefinition
}

/**
 * A read-only rendering of a preset's full room look — reuses
 * `WallSurface`/`FloorSurface`/`FurnitureIcon` exactly the way `Room.tsx`
 * composes them (same layering, same `ROOM_WIDTH`/`ROOM_HEIGHT`
 * logical-unit percentage math `FurnitureItem.tsx` uses), but never reads
 * from or writes to `useHomeStore` — every value comes straight from the
 * `preset` prop (a fixed, immutable `DecorPresetDefinition`), so opening or
 * closing this preview can never touch the real room.
 *
 * **Renders from `resolveDecorPresetFurniture(preset)` — the exact same
 * function `decorPresetApply.ts`'s `applyDecorPreset` calls to build the
 * placements it actually commits.** This used to recompute its own
 * position math inline (`xRatio * ROOM_WIDTH`, with no clamping at all),
 * which could disagree with what got applied — a real preview/apply
 * mismatch, not just a hypothetical one, since the shared placement
 * pipeline's floor-grounding adjustment (see
 * `furniturePlacementEngine.ts`) only ever ran on the apply path before.
 * Calling the one real resolver here instead is what guarantees the two
 * can never visually disagree, rather than trusting two independent
 * implementations to stay in sync by hand. No separate static
 * preview-image generation step exists (or is needed) for the same reason.
 * `useMemo` avoids re-resolving (and re-minting placement ids) on every
 * unrelated re-render — this component's own output never depends on
 * those ids anyway, only on `preset` itself.
 */
export function DecorPresetPreview({ preset }: DecorPresetPreviewProps) {
  const resolved = useMemo(() => resolveDecorPresetFurniture(preset), [preset])

  const style = {
    aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}`,
    '--floor-height': `${FLOOR_HEIGHT_RATIO * 100}%`,
  } as CSSProperties

  return (
    <div className="decor-preset-preview" style={style} role="img" aria-label={`${preset.name} 미리보기`}>
      <div className="decor-preset-preview-wall">
        <WallSurface settings={preset.wallpaper} />
      </div>
      <div className="decor-preset-preview-corner-shade decor-preset-preview-corner-shade-left" />
      <div className="decor-preset-preview-corner-shade decor-preset-preview-corner-shade-right" />
      <div className="decor-preset-preview-floor">
        <FloorSurface settings={preset.floor} />
      </div>
      <div className="decor-preset-preview-baseboard" />

      <div className="decor-preset-preview-surface">
        {resolved.map((placement) => {
          const definition = getFurnitureDefinition(placement.furnitureId)
          const size = getFurnitureSize(definition, placement.variant)
          const mirror = placement.rotation === 180 ? ' scaleX(-1)' : ''
          const itemStyle: CSSProperties = {
            left: `${(placement.x / ROOM_WIDTH) * 100}%`,
            top: `${(placement.y / ROOM_HEIGHT) * 100}%`,
            width: `${(size.width / ROOM_WIDTH) * 100}%`,
            height: `${(size.height / ROOM_HEIGHT) * 100}%`,
            transform: `translate(-50%, -50%) scale(${placement.scale})${mirror}`,
            zIndex: placement.layer,
          }
          return (
            <div key={placement.id} className="decor-preset-preview-item" style={itemStyle}>
              <FurnitureIcon
                furnitureId={placement.furnitureId}
                width={size.width}
                height={size.height}
                colorway={placement.colorway}
                variant={placement.variant}
                colors={placement.colors}
                patterns={placement.patterns}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
