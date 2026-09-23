import { useCharacterStore } from '../character/characterStore'
import { DialogueBubble } from './DialogueBubble'
import { useDialogueStore } from './dialogueStore'

export function DialogueFeed() {
  const entries = useDialogueStore((state) => state.entries)
  const characters = useCharacterStore((state) => state.characters)

  if (entries.length === 0) {
    return <p className="dialogue-feed-empty">아직 대화가 없어요. '대화하기' 버튼을 눌러 시작해 보세요.</p>
  }

  return (
    <div className="dialogue-feed">
      {entries.map((entry) => {
        const speakerIndex = characters.findIndex((c) => c.id === entry.speakerId)
        const speaker = speakerIndex >= 0 ? characters[speakerIndex] : undefined
        // With up to 5 characters there's no single "the other person" side — alternate by
        // registration order instead, so each entry is still visually distinguishable.
        const side = speakerIndex % 2 === 0 ? 'a' : 'b'

        return (
          <DialogueBubble
            key={entry.id}
            speakerName={speaker?.name ?? entry.speakerId}
            speakerImageDataUrl={speaker?.imageDataUrl}
            text={entry.text}
            side={side}
          />
        )
      })}
    </div>
  )
}
