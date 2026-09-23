export interface DialogueBubbleProps {
  speakerName: string
  speakerImageDataUrl?: string
  text: string
  /** Which side of the conversation this speaker is on — purely visual (left/right alignment). */
  side: 'a' | 'b'
}

/**
 * The single presentational bubble used both by the live dialogue feed
 * (DialogueFeed.tsx) and the character setup screen's tone preview
 * (CharacterDialoguePreview.tsx) — the spec requires the preview to reuse
 * the real simulation bubble, not a lookalike.
 */
export function DialogueBubble({ speakerName, speakerImageDataUrl, text, side }: DialogueBubbleProps) {
  return (
    <div className={side === 'a' ? 'dialogue-bubble dialogue-bubble-a' : 'dialogue-bubble dialogue-bubble-b'}>
      {speakerImageDataUrl && <img src={speakerImageDataUrl} alt={speakerName} className="dialogue-bubble-avatar" />}
      <div className="dialogue-bubble-content">
        <span className="dialogue-bubble-name">{speakerName}</span>
        <p className="dialogue-bubble-text">{text}</p>
      </div>
    </div>
  )
}
