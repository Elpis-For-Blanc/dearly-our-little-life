/** One line of dialogue. `speakerId` is always one of the registered characters' own ids. */
export interface DialogueLine {
  speakerId: string
  emotion: string
  text: string
}

/** The current scene context, shown/edited on the Live screen and stored alongside auto-dialogue entries for reference. */
export interface DialogueSituation {
  time: string
  place: string
  actionA: string
  actionB: string
}
