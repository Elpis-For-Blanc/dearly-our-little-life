import type { MonologueActivity, MonologueTimeBand, PartnerPresence } from './monologueTypes'
import type { RelationshipType } from './relationshipConfig'
import { RELATIONSHIP_MONOLOGUE_LINES } from './relationshipMonologueLibrary'
import { ROMANCE_MONOLOGUE_LINES } from './romanceMonologueLibrary'

/**
 * Built-in monologue lines — deliberately a separate data set from
 * `defaultDialogueLibrary.ts` (two-person bundles). Every line is a
 * statement to oneself: no question to anyone, nothing that expects a reply
 * (the tests check that no line contains a question mark or ends in a
 * question ending), no assumed past/job/family, and no action the simulation
 * doesn't actually perform (no reading, cooking, sleeping-in-bed, desk work).
 * What a line may claim is limited to what really exists: walking around
 * (`wandering`), standing still resting (`resting`), just having entered a
 * different room (`roomArrival`), and the real-clock time band.
 *
 * Every line has both register versions hand-written (never a suffix
 * appended to the other — see `defaultDialogueLibrary.ts` for why): `tone:
 * 'formal'` lines are for 존댓말 characters, `'casual'` for everyone else.
 */
export interface MonologueLineDef {
  id: string
  text: string
  /** Situation category — descriptive/analytics-friendly label, also used by tests to check coverage. */
  category: string
  /** Empty = usable in any time band. */
  timeBands: MonologueTimeBand[]
  /** Personality tag ids; empty = usable by any character. Non-empty = only characters holding at least one of these tags, and each match raises the line's weight. */
  personalityTags: string[]
  /** Empty = usable in any (permitted) activity. */
  activities: MonologueActivity[]
  tone: 'formal' | 'casual'
  /** Base selection weight, before personality/recency adjustments. */
  weight: number
  /**
   * Relationship-specific line (연인/부부 monologue): usable only while this
   * character has a partner whose relationship type is one of `relationships`
   * and who satisfies `presence` right now. Decided by relationship type id and
   * real simulation state — never by text. Absent on ordinary lines, which are
   * therefore never gated by relationships.
   */
  partnerCondition?: { relationships: RelationshipType[]; presence: PartnerPresence }
}

/** Registers the 반말 and 존댓말 version of one line together, under `${id}-c` / `${id}-f`. */
function pair(
  id: string,
  category: string,
  timeBands: MonologueTimeBand[],
  personalityTags: string[],
  activities: MonologueActivity[],
  weight: number,
  casual: string,
  formal: string,
): MonologueLineDef[] {
  const base = { category, timeBands, personalityTags, activities, weight }
  return [
    { ...base, id: `${id}-c`, tone: 'casual', text: casual },
    { ...base, id: `${id}-f`, tone: 'formal', text: formal },
  ]
}

const GENERAL_MONOLOGUE_LINES: MonologueLineDef[] = [
  // ---- 시간대: 아침
  ...pair('morning-1', 'morning', ['morning'], [], [], 1, '아침 햇살이 꽤 좋네.', '아침 햇살이 참 좋네요.'),
  ...pair('morning-2', 'morning', ['morning'], [], [], 1, '오늘 하루도 천천히 시작해 보자.', '오늘 하루도 천천히 시작해 봐야겠어요.'),
  ...pair('morning-3', 'morning', ['morning'], [], [], 1, '아침 공기는 역시 상쾌해.', '아침 공기는 역시 상쾌해요.'),
  ...pair('morning-4', 'morning', ['morning'], [], [], 1, '오늘은 어떤 하루가 될지 조금 기대되네.', '오늘은 어떤 하루가 될지 조금 기대돼요.'),
  ...pair('morning-5', 'morning', ['morning'], [], [], 1, '하루가 막 시작됐으니까 서두를 필요는 없어.', '하루가 막 시작됐으니 서두를 필요는 없어요.'),
  // ---- 시간대: 낮
  ...pair('day-1', 'daytime', ['day'], [], [], 1, '낮이라 그런지 집 안이 환하네.', '낮이라 그런지 집 안이 환하네요.'),
  ...pair('day-2', 'daytime', ['day'], [], [], 1, '슬슬 점심 때가 다가오는 것 같아.', '슬슬 점심 때가 다가오는 것 같아요.'),
  ...pair('day-3', 'daytime', ['day'], [], [], 1, '한창 활동하기 좋은 시간이야.', '한창 활동하기 좋은 시간이에요.'),
  ...pair('day-4', 'daytime', ['day'], [], [], 1, '하루의 한가운데쯤 왔구나.', '하루의 한가운데쯤 왔네요.'),
  // ---- 시간대: 오후
  ...pair('afternoon-1', 'afternoon', ['afternoon'], [], [], 1, '오후는 조금 나른한 시간이야.', '오후는 조금 나른한 시간이에요.'),
  ...pair('afternoon-2', 'afternoon', ['afternoon'], [], [], 1, '이런 오후엔 잠깐 숨을 돌려도 좋겠어.', '이런 오후엔 잠깐 숨을 돌려도 좋겠어요.'),
  ...pair('afternoon-3', 'afternoon', ['afternoon'], [], [], 1, '햇빛이 조금씩 기우는 것 같아.', '햇빛이 조금씩 기우는 것 같아요.'),
  ...pair('afternoon-4', 'afternoon', ['afternoon'], [], [], 1, '느긋한 오후가 천천히 흘러가고 있어.', '느긋한 오후가 천천히 흘러가고 있어요.'),
  // ---- 시간대: 저녁
  ...pair('evening-1', 'evening', ['evening'], [], [], 1, '하루가 벌써 저물어 가네.', '하루가 벌써 저물어 가네요.'),
  ...pair('evening-2', 'evening', ['evening'], [], [], 1, '오늘 하루도 이럭저럭 지나갔어.', '오늘 하루도 이럭저럭 지나갔어요.'),
  ...pair('evening-3', 'evening', ['evening'], [], [], 1, '저녁이 되니 마음이 좀 느긋해져.', '저녁이 되니 마음이 좀 느긋해져요.'),
  ...pair('evening-4', 'evening', ['evening'], [], [], 1, '슬슬 하루를 정리할 시간이야.', '슬슬 하루를 정리할 시간이에요.'),
  // ---- 시간대: 밤
  ...pair('night-1', 'night', ['night'], [], [], 1, '밤이 되니 집이 참 고요해.', '밤이 되니 집이 참 고요해요.'),
  ...pair('night-2', 'night', ['night'], [], [], 1, '밤에는 생각이 조용히 가라앉아.', '밤에는 생각이 조용히 가라앉아요.'),
  ...pair('night-3', 'night', ['night'], [], [], 1, '하루의 끝이 가까워졌네.', '하루의 끝이 가까워졌네요.'),
  ...pair('night-4', 'night', ['night'], [], [], 1, '졸음이 조금 오는 것 같아.', '졸음이 조금 오는 것 같아요.'),
  ...pair('night-5', 'night', ['night'], [], [], 1, '잠들기 전에 잠깐 조용히 있고 싶어.', '잠들기 전에 잠깐 조용히 있고 싶어요.'),

  // ---- 행동: 돌아다니는 중
  ...pair('wander-1', 'wander', [], [], ['wandering'], 1.2, '이쪽으로 걸으니 기분이 좋네.', '이쪽으로 걸으니 기분이 좋아요.'),
  ...pair('wander-2', 'wander', [], [], ['wandering'], 1.2, '천천히 걷는 것만으로도 머리가 맑아져.', '천천히 걷는 것만으로도 머리가 맑아져요.'),
  ...pair('wander-3', 'wander', [], [], ['wandering'], 1.2, '발길 닿는 대로 다녀 봐야지.', '발길 닿는 대로 다녀 봐야겠어요.'),
  ...pair('wander-4', 'wander', [], [], ['wandering'], 1.2, '집 안을 한 바퀴 도는 것도 나쁘지 않아.', '집 안을 한 바퀴 도는 것도 나쁘지 않네요.'),
  // ---- 행동: 잠시 쉬는 중
  ...pair('rest-1', 'rest', [], [], ['resting'], 1.2, '잠깐 이렇게 가만히 있는 것도 좋네.', '잠깐 이렇게 가만히 있는 것도 좋네요.'),
  ...pair('rest-2', 'rest', [], [], ['resting'], 1.2, '가끔은 아무것도 안 하는 시간이 필요해.', '가끔은 아무것도 안 하는 시간이 필요해요.'),
  ...pair('rest-3', 'rest', [], [], ['resting'], 1.2, '잠시 숨 돌리는 중이야.', '잠시 숨을 돌리는 중이에요.'),
  ...pair('rest-4', 'rest', [], [], ['resting'], 1.2, '이렇게 멈춰 있으니 마음이 느긋해져.', '이렇게 멈춰 있으니 마음이 느긋해져요.'),
  // ---- 행동: 방을 옮긴 직후
  ...pair('arrival-1', 'room-arrival', [], [], ['roomArrival'], 2, '이 방은 또 분위기가 다르네.', '이 방은 또 분위기가 다르네요.'),
  ...pair('arrival-2', 'room-arrival', [], [], ['roomArrival'], 2, '방이 바뀌니 기분도 살짝 달라져.', '방이 바뀌니 기분도 살짝 달라져요.'),
  ...pair('arrival-3', 'room-arrival', [], [], ['roomArrival'], 2, '이 방은 새롭게 느껴지네.', '이 방은 새롭게 느껴지네요.'),
  ...pair('arrival-4', 'room-arrival', [], [], ['roomArrival'], 2, '이 방의 공기는 또 달라.', '이 방의 공기는 또 달라요.'),

  // ---- 성격: 다정함 (누군가를 챙기고 싶은 마음)
  ...pair('affectionate-1', 'personality', [], ['affectionate'], [], 1, '다들 잘 지내고 있으면 좋겠어.', '다들 잘 지내고 있으면 좋겠어요.'),
  ...pair('affectionate-2', 'personality', [], ['affectionate'], [], 1, '누구든 힘든 일 없이 지냈으면 해.', '누구든 힘든 일 없이 지냈으면 해요.'),
  ...pair('affectionate-3', 'personality', [], ['affectionate'], [], 1, '따뜻한 하루가 되길 바라.', '따뜻한 하루가 되길 바라요.'),
  ...pair('affectionate-4', 'personality', [], ['affectionate'], [], 1, '작은 것 하나라도 챙겨 주고 싶어.', '작은 것 하나라도 챙겨 주고 싶어요.'),
  // ---- 성격: 무뚝뚝함 (짧고 담백하게)
  ...pair('gruff-1', 'personality', [], ['gruff'], [], 1.2, '…별일 없군.', '…별일 없군요.'),
  ...pair('gruff-2', 'personality', [], ['gruff'], [], 1.2, '이 정도면 됐어.', '이 정도면 됐습니다.'),
  ...pair('gruff-3', 'personality', [], ['gruff'], [], 1.2, '조용해서 낫네.', '조용해서 낫군요.'),
  ...pair('gruff-4', 'personality', [], ['gruff'], [], 1.2, '그냥 그렇지, 뭐.', '그냥 그렇죠, 뭐.'),
  // ---- 성격: 차분함 (조용한 관찰과 사색)
  ...pair('calm-1', 'personality', [], ['calm'], [], 1, '가만히 보면 모든 게 잔잔해.', '가만히 보면 모든 게 잔잔해요.'),
  ...pair('calm-2', 'personality', [], ['calm'], [], 1, '바쁠 것 없이 흘러가는 게 좋아.', '바쁠 것 없이 흘러가는 게 좋아요.'),
  ...pair('calm-3', 'personality', [], ['calm'], [], 1, '마음이 고요하면 주변도 또렷해 보여.', '마음이 고요하면 주변도 또렷해 보여요.'),
  ...pair('calm-4', 'personality', [], ['calm'], [], 1, '지금 이 순간을 그대로 바라보고 있어.', '지금 이 순간을 그대로 바라보고 있어요.'),
  // ---- 성격: 활발함 (다음 활동에 대한 기대)
  ...pair('energetic-1', 'personality', [], ['energetic'], [], 1, '오늘은 뭔가 재밌는 일이 생길 것 같아!', '오늘은 뭔가 재미있는 일이 생길 것 같아요!'),
  ...pair('energetic-2', 'personality', [], ['energetic'], [], 1, '몸이 근질근질해, 움직이고 싶어!', '몸이 근질근질해요, 움직이고 싶어요!'),
  ...pair('energetic-3', 'personality', [], ['energetic'], [], 1, '다음엔 뭘 해 볼지 벌써 기대돼!', '다음엔 뭘 해 볼지 벌써 기대돼요!'),
  ...pair('energetic-4', 'personality', [], ['energetic'], [], 1, '가만있기엔 에너지가 넘쳐!', '가만있기엔 에너지가 넘쳐요!'),
  // ---- 성격: 수줍음 (조용히 생각을 정리)
  ...pair('shy-1', 'personality', [], ['shy'], [], 1, '…괜히 혼자 생각이 많아지네.', '…괜히 혼자 생각이 많아지네요.'),
  ...pair('shy-2', 'personality', [], ['shy'], [], 1, '말로 꺼내기 전에 마음속으로 정리해 두자.', '말로 꺼내기 전에 마음속으로 정리해 둬야겠어요.'),
  ...pair('shy-3', 'personality', [], ['shy'], [], 1, '조금 쑥스럽지만 나쁘진 않아.', '조금 쑥스럽지만 나쁘진 않아요.'),
  ...pair('shy-4', 'personality', [], ['shy'], [], 1, '조용히 있는 게 가장 편해.', '조용히 있는 게 가장 편해요.'),
  // ---- 성격: 장난스러움 (가벼운 농담)
  ...pair('playful-1', 'personality', [], ['playful'], [], 1, '히히, 나만 아는 비밀이 하나 늘었어.', '후후, 저만 아는 비밀이 하나 늘었어요.'),
  ...pair('playful-2', 'personality', [], ['playful'], [], 1, '오늘은 왠지 장난을 치고 싶은 날이야.', '오늘은 왠지 장난을 치고 싶은 날이에요.'),
  ...pair('playful-3', 'personality', [], ['playful'], [], 1, '심심하면 나 혼자서도 웃을 수 있지.', '심심하면 저 혼자서도 웃을 수 있죠.'),
  ...pair('playful-4', 'personality', [], ['playful'], [], 1, '웃긴 생각이 하나 떠올랐어, 비밀이야.', '웃긴 생각이 하나 떠올랐어요, 비밀이에요.'),
  // ---- 성격: 게으름 (쉬고 싶은 마음)
  ...pair('lazy-1', 'personality', [], ['lazy'], [], 1, '아, 좀 쉬고 싶다…', '아, 좀 쉬고 싶네요…'),
  ...pair('lazy-2', 'personality', [], ['lazy'], [], 1, '느긋한 게 최고야.', '느긋한 게 최고예요.'),
  ...pair('lazy-3', 'personality', [], ['lazy'], [], 1, '서두르지 않아도 세상은 잘 돌아가.', '서두르지 않아도 세상은 잘 돌아가요.'),
  ...pair('lazy-4', 'personality', [], ['lazy'], [], 1, '움직이는 건 조금 이따가 해도 되겠지.', '움직이는 건 조금 이따가 해도 되겠죠.'),
  // ---- 성격: 부지런함 (해야 할 일을 떠올림 — 실제로 하는 행동은 묘사하지 않음)
  ...pair('diligent-1', 'personality', [], ['diligent'], [], 1, '정리할 게 없는지 자꾸 눈이 가네.', '정리할 게 없는지 자꾸 눈이 가네요.'),
  ...pair('diligent-2', 'personality', [], ['diligent'], [], 1, '해야 할 일을 하나씩 떠올려 보는 중이야.', '해야 할 일을 하나씩 떠올려 보는 중이에요.'),
  ...pair('diligent-3', 'personality', [], ['diligent'], [], 1, '미뤄 둔 집안일이 있었는지 생각나네.', '미뤄 둔 집안일이 있었는지 생각나네요.'),
  ...pair('diligent-4', 'personality', [], ['diligent'], [], 1, '부지런히 움직이면 마음도 개운해져.', '부지런히 움직이면 마음도 개운해져요.'),
  // ---- 성격: 호기심 (주변에 대한 궁금증)
  ...pair('curious-1', 'personality', [], ['curious'], [], 1, '이것저것 눈에 들어와서 자꾸 신경 쓰여.', '이것저것 눈에 들어와서 자꾸 신경 쓰여요.'),
  ...pair('curious-2', 'personality', [], ['curious'], [], 1, '이 방엔 아직 못 본 게 있을 것 같아.', '이 방엔 아직 못 본 게 있을 것 같아요.'),
  ...pair('curious-3', 'personality', [], ['curious'], [], 1, '궁금한 게 자꾸 생기네.', '궁금한 게 자꾸 생기네요.'),
  ...pair('curious-4', 'personality', [], ['curious'], [], 1, '구석구석 더 살펴보고 싶어.', '구석구석 더 살펴보고 싶어요.'),

  // ---- 공통: 어떤 시간·행동·성격에도 어울리는 일반 혼잣말 (fallback)
  ...pair('generic-1', 'generic', [], [], [], 1, '가만 보면 별일 없는 하루도 나쁘지 않아.', '가만 보면 별일 없는 하루도 나쁘지 않아요.'),
  ...pair('generic-2', 'generic', [], [], [], 1, '오늘도 여기서 지내고 있네.', '오늘도 여기서 지내고 있네요.'),
  ...pair('generic-3', 'generic', [], [], [], 1, '이런저런 생각이 스쳐 가.', '이런저런 생각이 스쳐 가요.'),
  ...pair('generic-4', 'generic', [], [], [], 1, '아무 일 없는 게 은근히 좋아.', '아무 일 없는 게 은근히 좋아요.'),
  ...pair('generic-5', 'generic', [], [], [], 1, '집은 언제나 편안해.', '집은 언제나 편안해요.'),
  ...pair('generic-6', 'generic', [], [], [], 1, '하루하루가 조금씩 쌓이는 것 같아.', '하루하루가 조금씩 쌓이는 것 같아요.'),
]

/** Ordinary lines plus the relationship-specific 연인/부부 lines (romanceMonologueLibrary.ts) — one static catalog, never copied into saved data. */
export const DEFAULT_MONOLOGUE_LIBRARY: MonologueLineDef[] = [...GENERAL_MONOLOGUE_LINES, ...ROMANCE_MONOLOGUE_LINES, ...RELATIONSHIP_MONOLOGUE_LINES]
