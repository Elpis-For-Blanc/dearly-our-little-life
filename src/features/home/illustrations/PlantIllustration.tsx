import { PLANT_COLORWAYS } from '../colorways'
import { FURNITURE_PALETTE as P } from '../palette'
import type { FurnitureIllustrationProps } from './types'

/** All measurements are fractions of width/height so the silhouette stays proportioned at any catalog size. */
export function PlantIllustration({ width, height, colorway }: FurnitureIllustrationProps) {
  const tones = PLANT_COLORWAYS[colorway] ?? PLANT_COLORWAYS.sage
  const cx = width / 2

  const potTop = height * 0.74
  const potBottom = height * 0.92
  const potHalfTop = width * 0.17
  const potHalfBottom = width * 0.12
  const rimY = potTop - height * 0.05
  const rimH = height * 0.08
  const rimHalfW = width * 0.195
  const soilY = potTop - height * 0.02
  const soilH = height * 0.045
  const soilHalfW = width * 0.15
  const stemTopY = height * 0.36
  const leafOuterY = height * 0.33
  const leafOuterOffsetX = width * 0.2
  const leafOuterRx = width * 0.19
  const leafOuterRy = height * 0.15
  const leafInnerY = height * 0.2
  const leafInnerOffsetX = width * 0.125
  const leafInnerRx = width * 0.16
  const leafInnerRy = height * 0.135
  const topLeafY = height * 0.13
  const topLeafRx = width * 0.15
  const topLeafRy = height * 0.14

  const shadowY = potBottom + height * 0.01

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="화분">
      {/* ambient shadow — soft, wide, barely visible */}
      <ellipse cx={cx} cy={shadowY} rx={width * 0.26} ry={height * 0.03} fill={P.shadowAmbient} />
      {/* contact shadow — tight, directly under the pot base, centered on the pot */}
      <ellipse cx={cx} cy={shadowY} rx={potHalfBottom + width * 0.02} ry={height * 0.014} fill={P.shadowContact} />

      {/* pot body */}
      <path
        d={`M ${cx - potHalfTop} ${potTop} L ${cx + potHalfTop} ${potTop} L ${cx + potHalfBottom} ${potBottom} L ${cx - potHalfBottom} ${potBottom} Z`}
        fill={P.terracotta.fill}
        stroke={P.terracotta.stroke}
        strokeWidth={1.2}
      />
      {/* pot rim */}
      <rect x={cx - rimHalfW} y={rimY} width={rimHalfW * 2} height={rimH} rx={rimH * 0.5} fill={P.terracotta.fill} stroke={P.terracotta.stroke} strokeWidth={1} />
      {/* a soft highlight on one side of the rim/body — the pot's own "명암" cue, matching every other renewed piece */}
      <ellipse cx={cx - rimHalfW * 0.4} cy={rimY + rimH * 0.4} rx={rimHalfW * 0.32} ry={rimH * 0.3} fill="#ffffff" opacity={0.28} pointerEvents="none" />
      {/* soil */}
      <rect x={cx - soilHalfW} y={soilY} width={soilHalfW * 2} height={soilH} rx={soilH * 0.5} fill="#5b4632" opacity={0.55} />

      {/* stem */}
      <line x1={cx} y1={rimY} x2={cx} y2={stemTopY} stroke={tones.leafDeep.stroke} strokeWidth={height * 0.015} />

      {/* leaves */}
      <ellipse
        cx={cx - leafOuterOffsetX}
        cy={leafOuterY}
        rx={leafOuterRx}
        ry={leafOuterRy}
        fill={tones.leaf.fill}
        stroke={tones.leaf.stroke}
        strokeWidth={1.1}
        transform={`rotate(-32 ${cx - leafOuterOffsetX} ${leafOuterY})`}
      />
      <ellipse
        cx={cx + leafOuterOffsetX}
        cy={leafOuterY}
        rx={leafOuterRx}
        ry={leafOuterRy}
        fill={tones.leaf.fill}
        stroke={tones.leaf.stroke}
        strokeWidth={1.1}
        transform={`rotate(32 ${cx + leafOuterOffsetX} ${leafOuterY})`}
      />
      <ellipse
        cx={cx - leafInnerOffsetX}
        cy={leafInnerY}
        rx={leafInnerRx}
        ry={leafInnerRy}
        fill={tones.leafDeep.fill}
        stroke={tones.leafDeep.stroke}
        strokeWidth={1.1}
        transform={`rotate(-16 ${cx - leafInnerOffsetX} ${leafInnerY})`}
      />
      <ellipse
        cx={cx + leafInnerOffsetX}
        cy={leafInnerY}
        rx={leafInnerRx}
        ry={leafInnerRy}
        fill={tones.leafDeep.fill}
        stroke={tones.leafDeep.stroke}
        strokeWidth={1.1}
        transform={`rotate(16 ${cx + leafInnerOffsetX} ${leafInnerY})`}
      />
      <ellipse cx={cx} cy={topLeafY} rx={topLeafRx} ry={topLeafRy} fill={tones.leaf.fill} stroke={tones.leaf.stroke} strokeWidth={1.1} />
    </svg>
  )
}
