import { useState, type CSSProperties } from 'react'
import { computeCharacterDisplayGeometry } from '../character/characterDisplay'
import type { Character } from '../character/types'
import { useDialogueStore } from '../dialogue/dialogueStore'
import { MONOLOGUE_DISPLAY_MS } from '../dialogue/monologueConfig'
import { useMonologueStore } from '../dialogue/monologueStore'
import { ROOM_HEIGHT, ROOM_WIDTH } from '../home/roomLayout'
import { useCharacterMovementStore } from './characterMovementStore'
import { BASE_CHARACTER_HEIGHT, SHADOW_HEIGHT_RATIO, SHADOW_WIDTH_RATIO } from './characterRenderConfig'
import './CharacterToken.css'

interface CharacterTokenProps {
  character: Character
}

/**
 * Renders one character's live position as a full sprite standing in the
 * room — purely presentational, all movement/collision math lives in
 * movementEngine.ts/useCharacterMovementSimulation.ts and never reads
 * anything from here. `movement.x`/`y` is the character's *foot* position
 * (the same point the collision circle in movementConfig.ts is centered
 * on) — the wrapper `<div>` sits at that exact point with no transform of
 * its own, and the shadow/sprite/name/speech-bubble each offset from that
 * one shared origin independently, so they can never visually separate.
 *
 * `footOffsetRatio` corrects for transparent padding under the character's
 * real feet in their uploaded PNG (an inherent per-image variance no pure
 * layout code can auto-detect) — it shifts only the sprite/placeholder,
 * never the shadow and never the logical movement coordinate itself.
 */
export function CharacterToken({ character }: CharacterTokenProps) {
  const movement = useCharacterMovementStore((state) => state.byId[character.id])
  const bubbleText = useDialogueStore((state) => state.activeBubbleByCharacter[character.id])
  const monologue = useMonologueStore((state) => state.activeByCharacter[character.id])
  const [imageFailed, setImageFailed] = useState(false)

  if (!movement) return null

  // Shadow sizing keys off the character's *intended* body height, not the
  // (possibly much larger, if the PNG has a lot of transparent padding)
  // rendered image height below — the shadow is the character's real
  // physical footprint, which shouldn't grow just because their uploaded
  // art happens to have empty space around a small drawing.
  const targetBodyHeightUnits = BASE_CHARACTER_HEIGHT * character.displayScale
  const shadowWidthUnits = targetBodyHeightUnits * SHADOW_WIDTH_RATIO
  const shadowHeightUnits = targetBodyHeightUnits * SHADOW_HEIGHT_RATIO

  const { renderedImageHeightUnits, footOffsetUnits, bubbleOffsetUnits } = computeCharacterDisplayGeometry(
    BASE_CHARACTER_HEIGHT,
    character.displayScale,
    character.footOffsetRatio,
    character.imageBounds,
  )

  const wrapperStyle: CSSProperties = {
    left: `${(movement.x / ROOM_WIDTH) * 100}%`,
    top: `${(movement.y / ROOM_HEIGHT) * 100}%`,
    zIndex: Math.round(movement.y),
  }

  const shadowStyle: CSSProperties = {
    width: `${(shadowWidthUnits / ROOM_WIDTH) * 100}%`,
    height: `${(shadowHeightUnits / ROOM_HEIGHT) * 100}%`,
  }

  // The sprite's own `top` (before its -100% transform) combines the
  // automatic imageBounds-derived correction with footOffsetRatio's manual
  // nudge — the shadow above never receives either, so it can't be "doubled up".
  const spriteStyle: CSSProperties = {
    height: `${(renderedImageHeightUnits / ROOM_HEIGHT) * 100}%`,
    top: `${(footOffsetUnits / ROOM_HEIGHT) * 100}%`,
  }

  // Anchored at the real drawn character's own top edge (not the image file's own top edge, which may be mostly transparent padding) — tracks displayScale/footOffsetRatio/imageBounds the same way the sprite does.
  const bubbleStyle: CSSProperties = {
    top: `${(bubbleOffsetUnits / ROOM_HEIGHT) * 100}%`,
  }

  return (
    <div className={`character-token character-token-${movement.status}`} style={wrapperStyle}>
      <div className="character-token-shadow" style={shadowStyle} />
      {!imageFailed && character.imageDataUrl ? (
        <img
          src={character.imageDataUrl}
          alt=""
          className="character-token-sprite"
          style={spriteStyle}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="character-token-placeholder" style={spriteStyle}>
          {character.name.charAt(0)}
        </div>
      )}
      <span className="character-token-name">{character.name}</span>
      {bubbleText ? (
        <div className="character-token-bubble" style={bubbleStyle}>
          {bubbleText}
        </div>
      ) : (
        monologue && (
          // Same anchor as the dialogue bubble (bubbleOffsetUnits), but never rendered alongside it — a real conversation line wins. `key` restarts the fade animation for each new monologue.
          <div
            key={monologue.startedAt}
            className="character-token-bubble character-token-monologue"
            style={{ ...bubbleStyle, animationDuration: `${MONOLOGUE_DISPLAY_MS}ms` }}
          >
            {monologue.text}
          </div>
        )
      )}
    </div>
  )
}
