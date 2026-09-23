import { DialogueBubble } from '../dialogue/DialogueBubble'
import type { Character, CharacterDialogueLine } from './types'

interface CharacterDialoguePreviewProps {
  character: Character
  line: CharacterDialogueLine | null
}

/** Reuses the real simulation bubble component so the preview matches what actually shows up in "함께 생활하기". */
export function CharacterDialoguePreview({ character, line }: CharacterDialoguePreviewProps) {
  if (!line) {
    return <p className="character-dialogue-preview-empty">대사 목록에서 '미리보기'를 눌러 말풍선으로 확인해 보세요.</p>
  }

  return (
    <div className="character-dialogue-preview">
      <DialogueBubble speakerName={character.name} speakerImageDataUrl={character.imageDataUrl} text={line.text} side="a" />
    </div>
  )
}
