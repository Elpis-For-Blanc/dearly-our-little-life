import { resolvePartTones } from '../furnitureStyling'
import { FURNITURE_PALETTE as P } from '../palette'
import { SurfaceSheen, Svg, VolumeShade } from './parts'
import { patternFill, surfacePattern } from './surface'
import type { FurnitureIllustrationProps } from './types'

/**
 * All measurements are fractions of width/height (not fixed px) so the
 * silhouette stays correctly proportioned at any catalog size. The two
 * cushion centers computed here are exactly what sofa-left/sofa-right's
 * interactionSlots in furnitureCatalog.ts are derived from — if these
 * fractions change, update those offsets too. (Leg/frame/arm/shadow
 * geometry below does NOT feed those offsets, so it can move freely.)
 */
export function SofaIllustration({ width, height, colorway, style }: FurnitureIllustrationProps) {
  const parts = resolvePartTones('sofa', colorway, style)
  const tones = { body: parts.body, cushion: parts.cushion }
  const legTone = parts.legs
  const bodyPattern = surfacePattern('body', style)
  const cushionPattern = surfacePattern('cushion', style)
  const bodyFill = patternFill(bodyPattern) ?? tones.body.fill
  const cushionFill = patternFill(cushionPattern) ?? tones.cushion.fill

  // Armrests and the base frame both reach down to groundY, so the legs
  // connect directly to the body with no gap between them.
  const groundY = height * 0.85
  const legH = height * 0.1 // within the spec's 8–12%-of-height range
  const legY = groundY - height * 0.02 // slight overlap into the frame for a seamless join
  const legW = width * 0.055
  const legCenterInset = width * 0.2 // distance of each leg's center from the sofa's own center — inboard of the armrests, under the body

  const armW = width * 0.12
  const armY = height * 0.15
  const armH = groundY - armY
  const backrestH = height * 0.44
  const backrestY = height * 0.04
  const backrestInset = width * 0.03
  const frameY = height * 0.34
  const frameH = groundY - frameY
  const frameInset = armW - width * 0.02
  const cushionInset = width * 0.16
  const cushionGap = width * 0.025
  const cushionY = height * 0.27
  const cushionH = height * 0.27
  const cushionW = (width - 2 * cushionInset - cushionGap) / 2

  const shadowY = legY + legH + height * 0.01

  return (
    <Svg width={width} height={height} label="소파" patterns={[bodyPattern, cushionPattern]}>
      {/* ambient shadow — soft, wide, barely visible */}
      <ellipse cx={width / 2} cy={shadowY} rx={width * 0.42} ry={height * 0.045} fill={P.shadowAmbient} />
      {/* contact shadow — tight, directly under the legs */}
      <ellipse cx={width / 2} cy={shadowY} rx={legCenterInset + legW} ry={height * 0.02} fill={P.shadowContact} />

      {/* backrest, set further back than the seat */}
      <rect
        x={backrestInset}
        y={backrestY}
        width={width - backrestInset * 2}
        height={backrestH}
        rx={backrestH * 0.35}
        fill={bodyFill}
        stroke={tones.body.stroke}
        strokeWidth={1.5}
      />
      <SurfaceSheen cx={width / 2} cy={backrestY + backrestH * 0.32} rx={width * 0.32} ry={backrestH * 0.22} />

      {/* armrests, taller than the cushions, reaching down to groundY — a soft shade on the right one's inner
          face and a sheen on the left one's outer curve is the sofa's one light-from-the-left depth cue,
          consistent everywhere else in this illustration. */}
      <rect x={0} y={armY} width={armW} height={armH} rx={armW * 0.45} fill={bodyFill} stroke={tones.body.stroke} strokeWidth={1.5} />
      <SurfaceSheen cx={armW * 0.32} cy={armY + armH * 0.3} rx={armW * 0.22} ry={armH * 0.22} opacity={0.22} />
      <rect x={width - armW} y={armY} width={armW} height={armH} rx={armW * 0.45} fill={bodyFill} stroke={tones.body.stroke} strokeWidth={1.5} />
      <VolumeShade cx={width - armW * 0.28} cy={armY + armH * 0.55} rx={armW * 0.24} ry={armH * 0.38} color={tones.body.stroke} opacity={0.14} />

      {/* base frame the two cushions sit in, reaching down to groundY so the legs connect with no gap */}
      <rect
        x={frameInset}
        y={frameY}
        width={width - frameInset * 2}
        height={frameH}
        rx={frameH * 0.12}
        fill={bodyFill}
        stroke={tones.body.stroke}
        strokeWidth={1.5}
      />
      {/* a soft shaded band right where the seat cushions will sit — reads as the seat's own recess/depth, drawn
          before the cushions so it only shows at their edges, not through them */}
      <VolumeShade cx={width / 2} cy={cushionY - height * 0.01} rx={width * 0.34} ry={height * 0.02} color={tones.body.stroke} opacity={0.18} />

      {/* two short, rounded front legs, inboard of the armrests under the body */}
      <rect x={width / 2 - legCenterInset - legW / 2} y={legY} width={legW} height={legH} rx={legW / 2} fill={legTone.fill} stroke={legTone.stroke} strokeWidth={1} />
      <rect x={width / 2 + legCenterInset - legW / 2} y={legY} width={legW} height={legH} rx={legW / 2} fill={legTone.fill} stroke={legTone.stroke} strokeWidth={1} />

      {/* two cushions with a visible seam between them */}
      <rect x={cushionInset} y={cushionY} width={cushionW} height={cushionH} rx={cushionH * 0.35} fill={cushionFill} stroke={tones.cushion.stroke} strokeWidth={1.2} />
      <rect
        x={cushionInset + cushionW + cushionGap}
        y={cushionY}
        width={cushionW}
        height={cushionH}
        rx={cushionH * 0.35}
        fill={cushionFill}
        stroke={tones.cushion.stroke}
        strokeWidth={1.2}
      />
      <line x1={width / 2} y1={cushionY + cushionH * 0.15} x2={width / 2} y2={cushionY + cushionH * 0.85} stroke={tones.cushion.stroke} strokeWidth={1} opacity={0.6} />
      <SurfaceSheen cx={cushionInset + cushionW / 2} cy={cushionY + cushionH * 0.28} rx={cushionW * 0.32} ry={cushionH * 0.16} opacity={0.26} />
      <SurfaceSheen cx={cushionInset + cushionW + cushionGap + cushionW / 2} cy={cushionY + cushionH * 0.28} rx={cushionW * 0.32} ry={cushionH * 0.16} opacity={0.26} />
    </Svg>
  )
}
