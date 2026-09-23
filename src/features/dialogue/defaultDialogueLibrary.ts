import type { RelationshipType } from './relationshipConfig'
import { RELATIONSHIP_DIALOGUE_BUNDLES } from './relationshipDialogueLibrary'
import { ROMANCE_DIALOGUE_BUNDLES } from './romanceDialogueLibrary'

/**
 * Hand-authored 존댓말 (formal/polite) and 반말 (casual/informal) versions of
 * the same line — never derived from one another by string manipulation
 * (e.g. appending "요"), since that produces broken grammar for plenty of
 * sentence shapes. Which one renders is picked at runtime from the
 * *speaking* character's own `tone.baseTone`; `mixed`/`custom` fall back to
 * the casual variant (see `resolveDefaultTurnText` in autoDialogueEngine.ts).
 */
export interface DefaultDialogueTurnText {
  formal: string
  casual: string
}

export interface DefaultDialogueTurn {
  /** Which participant speaks this turn, relative to the bundle's own start — resolved against whichever character is actually picked as first/second speaker at runtime, exactly like the user-authored-line path already alternates. */
  speaker: 'first' | 'second'
  emotion: string
  /** Keyword/category hooks so the existing personality `lineAffinity` heuristics (character/personalityTags.ts) can score these exactly like user-authored lines — see that file's OVERRIDES table for which tags actually look at this. */
  tags: string[]
  text: DefaultDialogueTurnText
}

export interface DefaultDialogueBundleDef {
  id: string
  /** A situationCategories.ts id — drives time-of-day gating the same way a registered line's categoryId does. */
  categoryId: string
  /** Undefined = usable for every relationship type (covers both "관계 미설정" and "동료"-like everyday pairs, which this app doesn't model as a distinct type — see CLAUDE.md). Otherwise restricted to exactly these types. */
  relationshipTypes?: RelationshipType[]
  /** Marks affection content: hard-excluded unless the pair's type allows romantic lines ('romantic' or 'married'), mirroring (but not guessing via keywords, since this is our own authored content) the rule user-authored lines get via isRomanticLine. `relationshipTypes` then narrows it to exactly 연인, 부부, or both. */
  romantic?: boolean
  /** 1-4 turns, already written as a coherent connected exchange — never shuffled or mixed with another bundle's turns. */
  turns: DefaultDialogueTurn[]
}

function t(speaker: 'first' | 'second', emotion: string, tags: string[], formal: string, casual: string): DefaultDialogueTurn {
  return { speaker, emotion, tags, text: { formal, casual } }
}

/**
 * The built-in, no-registration-required dialogue library. Every line is a
 * deliberately generic, universal sentence — it never presumes a job,
 * backstory, family role, or specific form of address the user hasn't set
 * (see CLAUDE.md's "no invented facts" rule, same spirit as the old AI
 * prompt-safety rules this project used to have before the AI system was
 * removed). Family-role terms of address are never used here, since those
 * are only appropriate when the user has actually set them — see
 * `character/CharacterAIProfileEditor.tsx`'s tone fields, which this
 * library never reads.
 */
const GENERAL_DIALOGUE_BUNDLES: DefaultDialogueBundleDef[] = [
  // ---- morning-greeting ----
  {
    id: 'default-morning-1',
    categoryId: 'morning-greeting',
    turns: [
      t('first', 'warm', ['아침', '인사'], '좋은 아침이에요.', '좋은 아침.'),
      t('second', 'warm', ['아침', '인사'], '네, 좋은 아침이에요. 잘 잤어요?', '어, 좋은 아침. 잘 잤어?'),
    ],
  },
  {
    id: 'default-morning-2',
    categoryId: 'morning-greeting',
    turns: [
      t('first', 'neutral', ['아침'], '오늘도 하루 시작이네요.', '오늘도 하루 시작이네.'),
      t('second', 'calm', ['차분', '아침'], '그러게요. 천천히 시작해 봐요.', '그러게. 천천히 시작해 보자.'),
    ],
  },

  // ---- wake-up ----
  {
    id: 'default-wakeup-1',
    categoryId: 'wake-up',
    turns: [
      t('first', 'sleepy', ['기상'], '이제 일어나셨어요?', '이제 일어났어?'),
      t('second', 'sleepy', ['기상'], '네, 방금 일어났어요. 아직 좀 졸리네요.', '어, 방금. 아직 좀 졸려.'),
    ],
  },
  {
    id: 'default-wakeup-2',
    categoryId: 'wake-up',
    turns: [t('first', 'gentle', ['기상'], '더 주무셔도 괜찮아요.', '더 자도 괜찮아.')],
  },

  // ---- breakfast ----
  {
    id: 'default-breakfast-1',
    categoryId: 'breakfast',
    turns: [
      t('first', 'neutral', ['식사', '아침'], '아침 식사 하셨어요?', '아침 먹었어?'),
      t('second', 'neutral', ['식사'], '네, 방금 먹었어요. 같이 드실래요?', '어, 방금. 같이 먹을래?'),
    ],
  },

  // ---- lunch ----
  {
    id: 'default-lunch-1',
    categoryId: 'lunch',
    turns: [
      t('first', 'neutral', ['식사', '점심'], '점심은 뭘 드실 거예요?', '점심 뭐 먹을 거야?'),
      t('second', 'thinking', ['식사'], '글쎄요, 아직 생각 안 해봤어요. 같이 정해봐요.', '글쎄, 아직 안 정했어. 같이 정하자.'),
    ],
  },

  // ---- afternoon-chat ----
  {
    id: 'default-afternoon-1',
    categoryId: 'afternoon-chat',
    turns: [
      t('first', 'neutral', ['오후', '일상'], '오후엔 뭐 하고 계셨어요?', '오후엔 뭐 하고 있었어?'),
      t('second', 'neutral', ['일상'], '그냥 이것저것 하고 있었어요. 별건 아니에요.', '그냥 이것저것. 별거 없어.'),
    ],
  },
  {
    id: 'default-afternoon-2',
    categoryId: 'afternoon-chat',
    turns: [t('first', 'calm', ['차분', '오후'], '오후 시간이 느긋하게 가네요.', '오후 시간이 느긋하게 가네.')],
  },

  // ---- snack ----
  {
    id: 'default-snack-1',
    categoryId: 'snack',
    turns: [
      t('first', 'playful', ['간식'], '뭐 간식 좀 드실래요?', '간식 좀 먹을래?'),
      t('second', 'happy', ['간식'], '좋아요, 저도 마침 출출했어요.', '좋아, 나도 마침 출출했어.'),
    ],
  },

  // ---- dinner ----
  {
    id: 'default-dinner-1',
    categoryId: 'dinner',
    turns: [
      t('first', 'neutral', ['식사', '저녁'], '저녁 식사 준비할까요?', '저녁 준비할까?'),
      t('second', 'neutral', ['식사'], '네, 좋아요. 같이 준비해요.', '어, 좋아. 같이 하자.'),
    ],
  },

  // ---- day-wrap-up ----
  {
    id: 'default-daywrap-1',
    categoryId: 'day-wrap-up',
    turns: [
      t('first', 'tired', ['하루', '마무리'], '오늘 하루도 다 갔네요.', '오늘 하루도 다 갔네.'),
      t('second', 'calm', ['차분', '하루'], '그러게요. 오늘도 고생 많았어요.', '그러게. 오늘도 고생 많았어.'),
    ],
  },

  // ---- pre-bedtime ----
  {
    id: 'default-prebedtime-1',
    categoryId: 'pre-bedtime',
    turns: [
      t('first', 'calm', ['차분', '밤'], '이제 슬슬 쉴 준비를 해야겠어요.', '이제 슬슬 쉴 준비 해야겠다.'),
      t('second', 'calm', ['차분'], '네, 오늘은 일찍 쉬는 게 좋겠어요.', '어, 오늘은 일찍 쉬는 게 좋겠어.'),
    ],
  },

  // ---- bedtime ----
  {
    id: 'default-bedtime-1',
    categoryId: 'bedtime',
    turns: [
      t('first', 'warm', ['밤', '인사'], '오늘도 수고 많았어요. 잘 자요.', '오늘도 고생했어. 잘 자.'),
      t('second', 'warm', ['밤', '인사'], '네, 당신도 잘 자요. 좋은 꿈 꿔요.', '어, 너도 잘 자. 좋은 꿈 꿔.'),
    ],
  },

  // ---- encounter ----
  {
    id: 'default-encounter-1',
    categoryId: 'encounter',
    turns: [
      t('first', 'surprised', ['마주침'], '어, 여기 계셨네요.', '어, 여기 있었네.'),
      t('second', 'happy', ['마주침'], '네, 마침 잘 만났어요.', '어, 마침 잘 만났다.'),
    ],
  },
  {
    id: 'default-encounter-2',
    categoryId: 'encounter',
    relationshipTypes: ['romantic', 'married'],
    romantic: true,
    turns: [
      t('first', 'happy', ['애정', '마주침'], '이렇게 또 마주치니까 괜히 반갑네요.', '이렇게 또 마주치니까 괜히 반갑다.'),
      t('second', 'warm', ['다정', '애정'], '저도요. 얼굴 보니까 좋아요.', '나도. 얼굴 보니까 좋다.'),
    ],
  },

  // ---- casual-chat ----
  {
    id: 'default-casual-1',
    categoryId: 'casual-chat',
    turns: [
      t('first', 'neutral', ['일상', '잡담'], '요즘 별일 없으세요?', '요즘 별일 없어?'),
      t('second', 'neutral', ['일상'], '네, 그냥 평범하게 지내고 있어요.', '어, 그냥 평범하게 지내.'),
    ],
  },
  {
    id: 'default-casual-2',
    categoryId: 'casual-chat',
    turns: [
      t('first', 'curious', ['일상', '질문'], '오늘 날씨 어때요?', '오늘 날씨 어때?'),
      t('second', 'neutral', ['일상'], '나쁘지 않아요. 산책하기 좋을 것 같아요.', '나쁘지 않아. 산책하기 좋을 것 같아.'),
    ],
  },
  {
    id: 'default-casual-3',
    categoryId: 'casual-chat',
    turns: [t('first', 'calm', ['차분', '일상'], '그냥 같이 있으니까 좋네요.', '그냥 같이 있으니까 좋다.')],
  },

  // ---- casual-chat, relationship-specific flavors ----
  {
    id: 'default-casual-rival-1',
    categoryId: 'casual-chat',
    relationshipTypes: ['rival'],
    turns: [
      t('first', 'competitive', ['경쟁', '직설'], '오늘도 지지 않을 거예요.', '오늘도 안 질 거야.'),
      t('second', 'competitive', ['경쟁'], '해볼 테면 해보세요. 저도 만만치 않아요.', '해볼 테면 해봐. 나도 만만치 않아.'),
    ],
  },
  {
    id: 'default-casual-awkward-1',
    categoryId: 'casual-chat',
    relationshipTypes: ['awkward'],
    turns: [
      t('first', 'shy', ['어색', '조심'], '저... 잘 지내셨어요?', '저... 잘 지냈어?'),
      t('second', 'shy', ['어색'], '아, 네. 그럭저럭요.', '아, 어. 그럭저럭.'),
    ],
  },

  // ---- resting-together ----
  {
    id: 'default-resting-1',
    categoryId: 'resting-together',
    turns: [
      t('first', 'calm', ['차분', '휴식'], '잠깐 같이 쉬었다 갈까요?', '잠깐 같이 쉬었다 갈까?'),
      t('second', 'calm', ['차분'], '좋아요, 저도 마침 쉬고 싶었어요.', '좋아, 나도 마침 쉬고 싶었어.'),
    ],
  },
  {
    id: 'default-resting-romantic-1',
    categoryId: 'resting-together',
    relationshipTypes: ['romantic', 'married'],
    romantic: true,
    turns: [
      t('first', 'warm', ['애정', '휴식'], '이렇게 기대서 쉬니까 편하네요.', '이렇게 기대서 쉬니까 편하다.'),
      t('second', 'warm', ['다정', '애정'], '그러게요, 이 시간이 참 좋아요.', '그러게, 이 시간이 참 좋다.'),
    ],
  },

  // ---- worried ----
  {
    id: 'default-worried-1',
    categoryId: 'worried',
    turns: [
      t('first', 'worried', ['걱정', '다정'], '표정이 좀 안 좋아 보여요, 무슨 일 있어요?', '표정이 좀 안 좋아 보이는데, 무슨 일 있어?'),
      t('second', 'reassuring', ['걱정'], '아니에요, 별일 아니에요. 신경 써줘서 고마워요.', '아니야, 별일 아니야. 신경 써줘서 고마워.'),
    ],
  },
  {
    id: 'default-worried-2',
    categoryId: 'worried',
    turns: [
      t('first', 'worried', ['걱정', '다정'], '요즘 무리하는 거 아니에요?', '요즘 무리하는 거 아니야?'),
      t('second', 'reassuring', ['걱정'], '괜찮아요, 무리는 안 하고 있어요.', '괜찮아, 무리는 안 해.'),
    ],
  },

  // ---- comfort ----
  {
    id: 'default-comfort-1',
    categoryId: 'comfort',
    turns: [
      t('first', 'sad', ['위로'], '오늘 좀 힘든 하루였어요.', '오늘 좀 힘든 하루였어.'),
      t('second', 'comforting', ['위로', '다정'], '고생했어요. 잠깐이라도 편히 쉬어요.', '고생했어. 잠깐이라도 편히 쉬어.'),
    ],
  },
  {
    id: 'default-comfort-2',
    categoryId: 'comfort',
    turns: [
      t('first', 'tired', ['위로'], '오늘은 뭘 해도 잘 안 풀리네요.', '오늘은 뭘 해도 잘 안 풀리네.'),
      t('second', 'comforting', ['위로', '다정'], '그런 날도 있는 거예요. 내일은 괜찮을 거예요.', '그런 날도 있는 거야. 내일은 괜찮을 거야.'),
    ],
  },

  // ---- teasing ----
  {
    id: 'default-teasing-1',
    categoryId: 'teasing',
    turns: [
      t('first', 'playful', ['장난', 'teasing'], '표정이 왜 그래요, 무슨 생각해요?', '표정이 왜 그래, 무슨 생각해?'),
      t('second', 'playful', ['장난'], '아무것도 아니에요! 놀리지 마세요.', '아무것도 아니야! 놀리지 마.'),
    ],
  },
  {
    id: 'default-teasing-2',
    categoryId: 'teasing',
    turns: [
      t('first', 'playful', ['장난', 'teasing'], '오늘따라 왜 이렇게 조용해요?', '오늘따라 왜 이렇게 조용해?'),
      t('second', 'playful', ['장난'], '그냥요. 갑자기 왜 놀리는 거예요.', '그냥. 갑자기 왜 놀리는 거야.'),
    ],
  },

  // ---- compliment ----
  {
    id: 'default-compliment-1',
    categoryId: 'compliment',
    turns: [
      t('first', 'admiring', ['칭찬', '다정'], '오늘따라 기분 좋아 보여요, 잘 어울려요.', '오늘따라 기분 좋아 보인다, 잘 어울려.'),
      t('second', 'bashful', ['칭찬'], '그런가요? 고마워요, 괜히 쑥스럽네요.', '그래? 고마워, 괜히 쑥스럽다.'),
    ],
  },
  {
    id: 'default-compliment-2',
    categoryId: 'compliment',
    turns: [
      t('first', 'admiring', ['칭찬'], '아까 그거, 진짜 잘했어요.', '아까 그거, 진짜 잘했어.'),
      t('second', 'happy', ['칭찬'], '그렇게 말해주니까 뿌듯하네요.', '그렇게 말해주니까 뿌듯하다.'),
    ],
  },

  // ---- favor ----
  {
    id: 'default-favor-1',
    categoryId: 'favor',
    turns: [
      t('first', 'asking', ['부탁'], '혹시 잠깐 부탁 하나 해도 될까요?', '혹시 잠깐 부탁 하나 해도 돼?'),
      t('second', 'willing', ['부탁'], '그럼요, 말씀해 보세요.', '그럼, 말해봐.'),
    ],
  },

  // ---- gratitude ----
  {
    id: 'default-gratitude-1',
    categoryId: 'gratitude',
    turns: [
      t('first', 'grateful', ['감사'], '아까는 정말 고마웠어요.', '아까는 정말 고마웠어.'),
      t('second', 'warm', ['감사', '다정'], '별거 아니에요, 도움이 됐다면 다행이에요.', '별거 아니야, 도움이 됐다면 다행이야.'),
    ],
  },

  // ---- apology ----
  {
    id: 'default-apology-1',
    categoryId: 'apology',
    turns: [
      t('first', 'apologetic', ['사과'], '아까는 제가 좀 무심했던 것 같아요, 미안해요.', '아까는 내가 좀 무심했던 것 같아, 미안해.'),
      t('second', 'reassuring', ['사과'], '괜찮아요, 그렇게 신경 안 써도 돼요.', '괜찮아, 그렇게 신경 안 써도 돼.'),
    ],
  },

  // ---- calling-partner ----
  {
    id: 'default-calling-1',
    categoryId: 'calling-partner',
    turns: [
      t('first', 'neutral', ['다정'], '저기, 시간 괜찮으세요?', '저기, 시간 괜찮아?'),
      t('second', 'neutral', [], '네, 왜요?', '어, 왜?'),
    ],
  },
]

/** General bundles, the 연인/부부 affection bundles (romanceDialogueLibrary.ts) and the relationship-specific ones (relationshipDialogueLibrary.ts) — one static catalog, never copied into saved data. */
export const DEFAULT_DIALOGUE_BUNDLES: DefaultDialogueBundleDef[] = [...GENERAL_DIALOGUE_BUNDLES, ...ROMANCE_DIALOGUE_BUNDLES, ...RELATIONSHIP_DIALOGUE_BUNDLES]
