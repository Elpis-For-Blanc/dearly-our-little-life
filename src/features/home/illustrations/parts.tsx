import type { ReactNode } from 'react'
import { FURNITURE_PALETTE as P, type PaletteTone } from '../palette'
import { FurniturePatternDef } from '../patterns/furniturePatterns'
import type { SurfacePattern } from './surface'

export const SW = 1.5

/** Every illustration is an SVG in its own `width x height` logical box, so the catalog preview and the placed item render the exact same drawing. */
export function Svg({
  width,
  height,
  label,
  patterns,
  children,
}: {
  width: number
  height: number
  label: string
  /** The surface patterns this piece uses; each becomes a `<pattern>` in this SVG's own `<defs>`. */
  patterns?: Array<SurfacePattern | null>
  children: ReactNode
}) {
  const used = (patterns ?? []).filter((p): p is SurfacePattern => p !== null)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label={label}>
      {used.length > 0 && (
        <defs>
          {used.map((p) => (
            <FurniturePatternDef key={p.id} id={p.id} setting={p.setting} tileScale={p.tileScale} />
          ))}
        </defs>
      )}
      {children}
    </svg>
  )
}

interface BlockProps {
  x: number
  y: number
  w: number
  h: number
  r?: number
  tone: PaletteTone
  sw?: number
  opacity?: number
  /** Overrides the tone's fill/stroke for inner details (`'none'` for an outline-only panel). */
  fill?: string
  stroke?: string
}

/** A rounded rectangle in a palette tone — the building block for bodies, doors, drawers, cushions. */
export function Block({ x, y, w, h, r = 0, tone, sw = SW, opacity, fill, stroke }: BlockProps) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={fill ?? tone.fill} stroke={stroke ?? tone.stroke} strokeWidth={sw} opacity={opacity} />
}

/**
 * Two-layer ground shadow drawn inside the SVG (see CLAUDE.md — never a CSS
 * drop-shadow). `y` must be the furniture's real lowest structural point (leg
 * bottom, frame bottom, base bottom), so the shadow always sits under the
 * piece instead of at a guessed spot; `unit` scales the ellipse thickness.
 */
export function GroundShadow({ cx, y, ambientRx, contactRx, unit }: { cx: number; y: number; ambientRx: number; contactRx: number; unit: number }) {
  return (
    <>
      <ellipse cx={cx} cy={y} rx={ambientRx} ry={unit * 0.045} fill={P.shadowAmbient} />
      <ellipse cx={cx} cy={y} rx={contactRx} ry={unit * 0.02} fill={P.shadowContact} />
    </>
  )
}

/** A short rounded wooden leg. `y` is its top; its bottom (`y + h`) is where the piece touches the floor. */
export function Leg({ x, y, w, h, tone = P.taupe, opacity }: { x: number; y: number; w: number; h: number; tone?: PaletteTone; opacity?: number }) {
  return <Block x={x} y={y} w={w} h={h} r={w / 2} tone={tone} sw={1} opacity={opacity} />
}

export function Knob({ cx, cy, r, tone = P.metal }: { cx: number; cy: number; r: number; tone?: PaletteTone }) {
  return <circle cx={cx} cy={cy} r={r} fill={tone.fill} stroke={tone.stroke} strokeWidth={1} />
}

/**
 * A tabletop seen slightly from above: a trapezoid top face (back edge
 * narrower, `inset`) over a front edge of `thick`, so the slab reads as a
 * solid board with depth rather than a flat rectangle. Includes its own
 * soft top-face sheen (see `SurfaceSheen`) — every table using this shared
 * primitive (the original table, dining-table, coffee-table, desk, sink)
 * gets the same "부드럽고 세련된" polish automatically, in one place,
 * rather than needing it added file by file.
 */
export function Tabletop({ x, y, w, depth, thick, inset, tone }: { x: number; y: number; w: number; depth: number; thick: number; inset: number; tone: PaletteTone }) {
  return (
    <>
      <polygon points={`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + depth} ${x},${y + depth}`} fill={tone.fill} stroke={tone.stroke} strokeWidth={SW} strokeLinejoin="round" />
      <SurfaceSheen cx={x + w / 2} cy={y + depth * 0.32} rx={w * 0.28} ry={depth * 0.32} opacity={0.28} />
      <rect x={x} y={y + depth} width={w} height={thick} rx={thick * 0.3} fill={tone.fill} stroke={tone.stroke} strokeWidth={SW} />
      <rect x={x + 1} y={y + depth + 1} width={w - 2} height={thick - 2} rx={thick * 0.25} fill={tone.stroke} opacity={0.22} />
    </>
  )
}

/**
 * A soft, translucent highlight near the top of a surface — the shared
 * "부드럽고 세련된" material cue every renewed sofa/chair/table/lamp
 * illustration uses instead of a flat, shadowless fill (see CLAUDE.md's
 * furniture-visual-renewal section). Horizontally centered on its own `cx`
 * by convention wherever it's used, so it reads correctly whether the
 * placement is mirrored (`scaleX(-1)`) or not — never draw one off-center
 * unless the whole piece is already asymmetric by design.
 */
export function SurfaceSheen({ cx, cy, rx, ry, opacity = 0.32 }: { cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#ffffff" opacity={opacity} pointerEvents="none" />
}

/**
 * `SurfaceSheen`'s opposite number: a soft, translucent shading patch on
 * *one* side of a volume, using that part's own `tone.stroke` (never a flat
 * black) so it reads as gentle shading, not a new outline. Paired with
 * `SurfaceSheen` this is the entire "명암" (light-from-one-side depth cue)
 * this project's furniture uses — a shape, not a gradient/filter, so it
 * costs nothing extra to render and never fights the SVG-internal shadow
 * rule (CLAUDE.md: shadows/shading are drawn inside the SVG, never a CSS
 * filter). Low default opacity — this must stay a whisper, not a second
 * outline.
 */
export function VolumeShade({ cx, cy, rx, ry, color, opacity = 0.16 }: { cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} opacity={opacity} pointerEvents="none" />
}

/** A book standing on a shelf, used by the bookshelf and the tabletop rack. */
export function Book({ x, y, w, h, tone }: { x: number; y: number; w: number; h: number; tone: PaletteTone }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={tone.fill} stroke={tone.stroke} strokeWidth={1} />
      <line x1={x + w * 0.28} y1={y + h * 0.12} x2={x + w * 0.28} y2={y + h * 0.88} stroke={tone.stroke} strokeWidth={0.8} opacity={0.7} />
    </>
  )
}
