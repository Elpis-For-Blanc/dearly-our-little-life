import type { MonologueLineDef } from './defaultMonologueLibrary'
import type { PartnerPresence } from './monologueTypes'
import type { RelationshipType } from './relationshipConfig'

/**
 * 연인/부부 monologue lines (70 situations × hand-written 반말/존댓말 = 140
 * entries): 30 연인-only (`mono-love-*`, 01-15 original + 16-30 batch 2),
 * 30 부부-only (`mono-spouse-*`, 01-15 original + 16-30 batch 2), 10 shared
 * (`mono-couple-*`, unchanged). Each is gated by a `partnerCondition` — the
 * relationship type id plus a *checkable* presence fact (same room / other
 * room / just talked) — so a line about the partner being around is only
 * ever spoken when they really are, and never for a character without a
 * romantic partner. No names, nicknames, or references to what was said.
 * Batch 2 keeps the same 6 sameRoom / 4 otherRoom / 5 recentTalk split per
 * 15-situation group and the same "no marriage length/children" rule.
 */

const LOVE: RelationshipType[] = ['romantic']
const SPOUSE: RelationshipType[] = ['married']
const BOTH: RelationshipType[] = ['romantic', 'married']

function romance(
  id: string,
  category: string,
  relationships: RelationshipType[],
  presence: PartnerPresence,
  casual: string,
  formal: string,
): MonologueLineDef[] {
  const base = { category, timeBands: [], personalityTags: [], activities: [], weight: 1.5, partnerCondition: { relationships, presence } }
  return [
    { ...base, id: `${id}-c`, tone: 'casual', text: casual },
    { ...base, id: `${id}-f`, tone: 'formal', text: formal },
  ]
}

export const ROMANCE_MONOLOGUE_LINES: MonologueLineDef[] = [
  // ---- 연인 전용 (15)
  ...romance('mono-love-01', 'romance-love', LOVE, 'sameRoom', '같은 방에 있는 것만으로도 기분이 좋아.', '같은 방에 있는 것만으로도 기분이 좋아요.'),
  ...romance('mono-love-02', 'romance-love', LOVE, 'sameRoom', '괜히 자꾸 신경 쓰이네. 같은 방이라 그런가 봐.', '괜히 자꾸 신경 쓰이네요. 같은 방이라 그런가 봐요.'),
  ...romance('mono-love-03', 'romance-love', LOVE, 'sameRoom', '같은 공간에 있다고 생각하니 마음이 포근해져.', '같은 공간에 있다고 생각하니 마음이 포근해져요.'),
  ...romance('mono-love-04', 'romance-love', LOVE, 'sameRoom', '같은 방 어딘가에 있다는 게 든든해.', '같은 방 어딘가에 있다는 게 든든해요.'),
  ...romance('mono-love-05', 'romance-love', LOVE, 'sameRoom', '곁에 있다고 생각하니 괜히 웃음이 나.', '곁에 있다고 생각하니 괜히 웃음이 나요.'),
  ...romance('mono-love-06', 'romance-love', LOVE, 'sameRoom', '같이 있는 시간이 천천히 흘렀으면 좋겠어.', '같이 있는 시간이 천천히 흘렀으면 좋겠어요.'),
  ...romance('mono-love-07', 'romance-love', LOVE, 'otherRoom', '다른 방에 있는데도 자꾸 생각나.', '다른 방에 있는데도 자꾸 생각나요.'),
  ...romance('mono-love-08', 'romance-love', LOVE, 'otherRoom', '잠깐 떨어져 있으니 얼굴이 보고 싶어지네.', '잠깐 떨어져 있으니 얼굴이 보고 싶어지네요.'),
  ...romance('mono-love-09', 'romance-love', LOVE, 'otherRoom', '지금쯤 편히 지내고 있으면 좋겠다.', '지금쯤 편히 지내고 있으면 좋겠어요.'),
  ...romance('mono-love-10', 'romance-love', LOVE, 'otherRoom', '다음에 만나면 무슨 말로 인사할지 생각 중이야.', '다음에 만나면 무슨 말로 인사할지 생각 중이에요.'),
  ...romance('mono-love-11', 'romance-love', LOVE, 'recentTalk', '조금 전에 나눈 이야기가 자꾸 떠올라서 웃음이 나.', '조금 전에 나눈 이야기가 자꾸 떠올라서 웃음이 나요.'),
  ...romance('mono-love-12', 'romance-love', LOVE, 'recentTalk', '방금 대화가 마음에 오래 남아.', '방금 대화가 마음에 오래 남아요.'),
  ...romance('mono-love-13', 'romance-love', LOVE, 'recentTalk', '이야기하고 나니 기분이 한결 좋아졌어.', '이야기하고 나니 기분이 한결 좋아졌어요.'),
  ...romance('mono-love-14', 'romance-love', LOVE, 'recentTalk', '좋은 사람이라고 새삼 생각했어.', '좋은 사람이라고 새삼 생각했어요.'),
  ...romance('mono-love-15', 'romance-love', LOVE, 'recentTalk', '다음엔 내가 먼저 말을 걸어야지.', '다음엔 제가 먼저 말을 걸어야겠어요.'),

  // ---- 연인 전용 배치 2 (16-30)
  ...romance('mono-love-16', 'romance-love', LOVE, 'sameRoom', '같은 공간에 있다는 것만으로 웃음이 새어 나와.', '같은 공간에 있다는 것만으로 웃음이 새어 나와요.'),
  ...romance('mono-love-17', 'romance-love', LOVE, 'sameRoom', '괜히 자꾸 이쪽으로 눈이 가.', '괜히 자꾸 이쪽으로 눈이 가요.'),
  ...romance('mono-love-18', 'romance-love', LOVE, 'sameRoom', '같이 있으면 심장이 은근히 바빠져.', '같이 있으면 심장이 은근히 바빠져요.'),
  ...romance('mono-love-19', 'romance-love', LOVE, 'sameRoom', '말 걸 핑계를 괜히 찾고 있어.', '말 걸 핑계를 괜히 찾고 있어요.'),
  ...romance('mono-love-20', 'romance-love', LOVE, 'sameRoom', '옆에 있다는 것만으로 하루가 특별해져.', '옆에 있다는 것만으로 하루가 특별해져요.'),
  ...romance('mono-love-21', 'romance-love', LOVE, 'sameRoom', '이 방 안에 있는 게 오늘의 제일 좋은 일이야.', '이 방 안에 있는 게 오늘의 제일 좋은 일이에요.'),
  ...romance('mono-love-22', 'romance-love', LOVE, 'otherRoom', '다른 방에 있어도 마음 한쪽이 그쪽으로 기울어.', '다른 방에 있어도 마음 한쪽이 그쪽으로 기울어요.'),
  ...romance('mono-love-23', 'romance-love', LOVE, 'otherRoom', '떨어져 있으니까 더 또렷하게 생각나.', '떨어져 있으니까 더 또렷하게 생각나요.'),
  ...romance('mono-love-24', 'romance-love', LOVE, 'otherRoom', '지금 뭐 하고 있을지 자꾸 궁금해져.', '지금 뭐 하고 있을지 자꾸 궁금해져요.'),
  ...romance('mono-love-25', 'romance-love', LOVE, 'otherRoom', '빨리 마주치고 싶어서 괜히 서성이게 돼.', '빨리 마주치고 싶어서 괜히 서성이게 돼요.'),
  ...romance('mono-love-26', 'romance-love', LOVE, 'recentTalk', '아까 그 웃는 얼굴이 자꾸 떠올라.', '아까 그 웃는 얼굴이 자꾸 떠올라요.'),
  ...romance('mono-love-27', 'romance-love', LOVE, 'recentTalk', '방금 들은 말 한마디가 하루 종일 남을 것 같아.', '방금 들은 말 한마디가 하루 종일 남을 것 같아요.'),
  ...romance('mono-love-28', 'romance-love', LOVE, 'recentTalk', '별거 아닌 얘기였는데도 마음이 몽글몽글해.', '별거 아닌 얘기였는데도 마음이 몽글몽글해요.'),
  ...romance('mono-love-29', 'romance-love', LOVE, 'recentTalk', '대화 끝나고도 계속 여운이 남아.', '대화 끝나고도 계속 여운이 남아요.'),
  ...romance('mono-love-30', 'romance-love', LOVE, 'recentTalk', '다음엔 무슨 말로 웃겨 줄지 벌써 고민돼.', '다음엔 무슨 말로 웃겨 줄지 벌써 고민돼요.'),

  // ---- 부부 전용 (15)
  ...romance('mono-spouse-01', 'romance-spouse', SPOUSE, 'sameRoom', '같은 방에 있으니 마음이 편해.', '같은 방에 있으니 마음이 편해요.'),
  ...romance('mono-spouse-02', 'romance-spouse', SPOUSE, 'sameRoom', '말을 안 해도 곁에 있는 게 느껴져서 좋아.', '말을 안 해도 곁에 있는 게 느껴져서 좋아요.'),
  ...romance('mono-spouse-03', 'romance-spouse', SPOUSE, 'sameRoom', '이렇게 같은 공간에 있는 게 자연스러워.', '이렇게 같은 공간에 있는 게 자연스러워요.'),
  ...romance('mono-spouse-04', 'romance-spouse', SPOUSE, 'sameRoom', '곁에 누군가 있다는 건 참 든든한 일이야.', '곁에 누군가 있다는 건 참 든든한 일이에요.'),
  ...romance('mono-spouse-05', 'romance-spouse', SPOUSE, 'sameRoom', '함께 있으면 집이 더 집 같아.', '함께 있으면 집이 더 집 같아요.'),
  ...romance('mono-spouse-06', 'romance-spouse', SPOUSE, 'sameRoom', '조용히 함께 있는 시간이 제일 편해.', '조용히 함께 있는 시간이 제일 편해요.'),
  ...romance('mono-spouse-07', 'romance-spouse', SPOUSE, 'otherRoom', '다른 방에 있어도 같은 집에 있다는 게 든든해.', '다른 방에 있어도 같은 집에 있다는 게 든든해요.'),
  ...romance('mono-spouse-08', 'romance-spouse', SPOUSE, 'otherRoom', '지금쯤 편히 쉬고 있겠지.', '지금쯤 편히 쉬고 있겠죠.'),
  ...romance('mono-spouse-09', 'romance-spouse', SPOUSE, 'otherRoom', '무리하지 않고 있으면 좋겠다.', '무리하지 않고 있으면 좋겠어요.'),
  ...romance('mono-spouse-10', 'romance-spouse', SPOUSE, 'otherRoom', '얼굴을 보면 오늘 어땠는지 물어봐야지.', '얼굴을 보면 오늘 어땠는지 물어봐야겠어요.'),
  ...romance('mono-spouse-11', 'romance-spouse', SPOUSE, 'recentTalk', '조금 전 이야기 덕분에 마음이 가벼워졌어.', '조금 전 이야기 덕분에 마음이 가벼워졌어요.'),
  ...romance('mono-spouse-12', 'romance-spouse', SPOUSE, 'recentTalk', '방금 대화가 참 편안했어.', '방금 대화가 참 편안했어요.'),
  ...romance('mono-spouse-13', 'romance-spouse', SPOUSE, 'recentTalk', '함께 이야기하는 시간은 언제나 좋아.', '함께 이야기하는 시간은 언제나 좋아요.'),
  ...romance('mono-spouse-14', 'romance-spouse', SPOUSE, 'recentTalk', '이런 소소한 대화가 하루를 채워 주는 것 같아.', '이런 소소한 대화가 하루를 채워 주는 것 같아요.'),
  ...romance('mono-spouse-15', 'romance-spouse', SPOUSE, 'recentTalk', '다음에 만나면 고맙다고 말해 줘야지.', '다음에 만나면 고맙다고 말해 줘야겠어요.'),

  // ---- 부부 전용 배치 2 (16-30)
  ...romance('mono-spouse-16', 'romance-spouse', SPOUSE, 'sameRoom', '같은 공간에 있으면 괜히 마음이 느슨해져.', '같은 공간에 있으면 괜히 마음이 느슨해져요.'),
  ...romance('mono-spouse-17', 'romance-spouse', SPOUSE, 'sameRoom', '별말 안 해도 옆에 있는 것만으로 충분해.', '별말 안 해도 옆에 있는 것만으로 충분해요.'),
  ...romance('mono-spouse-18', 'romance-spouse', SPOUSE, 'sameRoom', '같이 있으면 괜히 발걸음도 가벼워져.', '같이 있으면 괜히 발걸음도 가벼워져요.'),
  ...romance('mono-spouse-19', 'romance-spouse', SPOUSE, 'sameRoom', '이 방에 둘이 있는 게 오늘 제일 편한 시간이야.', '이 방에 둘이 있는 게 오늘 제일 편한 시간이에요.'),
  ...romance('mono-spouse-20', 'romance-spouse', SPOUSE, 'sameRoom', '옆에 있는 걸 보니 오늘 하루도 무사히 지나가는 것 같아.', '옆에 있는 걸 보니 오늘 하루도 무사히 지나가는 것 같아요.'),
  ...romance('mono-spouse-21', 'romance-spouse', SPOUSE, 'sameRoom', '굳이 말 안 해도 편한 사이라 다행이야.', '굳이 말 안 해도 편한 사이라 다행이에요.'),
  ...romance('mono-spouse-22', 'romance-spouse', SPOUSE, 'otherRoom', '다른 방에 있어도 집 안에 같이 있다는 게 든든해.', '다른 방에 있어도 집 안에 같이 있다는 게 든든해요.'),
  ...romance('mono-spouse-23', 'romance-spouse', SPOUSE, 'otherRoom', '잠깐 안 보이니까 뭐 하고 있는지 괜히 궁금해.', '잠깐 안 보이니까 뭐 하고 있는지 괜히 궁금해요.'),
  ...romance('mono-spouse-24', 'romance-spouse', SPOUSE, 'otherRoom', '떨어져 있어도 오늘 하루 잘 보내고 있길 바라.', '떨어져 있어도 오늘 하루 잘 보내고 있길 바라요.'),
  ...romance('mono-spouse-25', 'romance-spouse', SPOUSE, 'otherRoom', '마주치면 오늘 있었던 일부터 물어봐야지.', '마주치면 오늘 있었던 일부터 물어봐야겠어요.'),
  ...romance('mono-spouse-26', 'romance-spouse', SPOUSE, 'recentTalk', '방금 나눈 짧은 대화가 마음에 콕 박혀 있어.', '방금 나눈 짧은 대화가 마음에 콕 박혀 있어요.'),
  ...romance('mono-spouse-27', 'romance-spouse', SPOUSE, 'recentTalk', '별거 아닌 얘기였는데 자꾸 곱씹게 돼.', '별거 아닌 얘기였는데 자꾸 곱씹게 돼요.'),
  ...romance('mono-spouse-28', 'romance-spouse', SPOUSE, 'recentTalk', '방금 그 말투, 듣기 좋았어.', '방금 그 말투, 듣기 좋았어요.'),
  ...romance('mono-spouse-29', 'romance-spouse', SPOUSE, 'recentTalk', '대화하고 나니 오늘 하루가 한결 가벼워졌어.', '대화하고 나니 오늘 하루가 한결 가벼워졌어요.'),
  ...romance('mono-spouse-30', 'romance-spouse', SPOUSE, 'recentTalk', '다음에 만나면 방금 못다 한 말을 마저 해야지.', '다음에 만나면 방금 못다 한 말을 마저 해야겠어요.'),

  // ---- 연인·부부 공용 (10)
  ...romance('mono-couple-01', 'romance-shared', BOTH, 'sameRoom', '같은 방에 있다는 사실만으로도 충분히 좋아.', '같은 방에 있다는 사실만으로도 충분히 좋아요.'),
  ...romance('mono-couple-02', 'romance-shared', BOTH, 'sameRoom', '함께 있는 이 순간을 잘 기억해 두고 싶어.', '함께 있는 이 순간을 잘 기억해 두고 싶어요.'),
  ...romance('mono-couple-03', 'romance-shared', BOTH, 'sameRoom', '눈이 마주치지 않아도 곁에 있다는 게 느껴져.', '눈이 마주치지 않아도 곁에 있다는 게 느껴져요.'),
  ...romance('mono-couple-04', 'romance-shared', BOTH, 'otherRoom', '다른 방에 있어도 마음은 가까운 것 같아.', '다른 방에 있어도 마음은 가까운 것 같아요.'),
  ...romance('mono-couple-05', 'romance-shared', BOTH, 'otherRoom', '잠깐 떨어져 있으니 더 소중하게 느껴져.', '잠깐 떨어져 있으니 더 소중하게 느껴져요.'),
  ...romance('mono-couple-06', 'romance-shared', BOTH, 'otherRoom', '다음에 만나면 반갑게 인사해야지.', '다음에 만나면 반갑게 인사해야겠어요.'),
  ...romance('mono-couple-07', 'romance-shared', BOTH, 'recentTalk', '방금 나눈 이야기가 마음을 따뜻하게 해.', '방금 나눈 이야기가 마음을 따뜻하게 해요.'),
  ...romance('mono-couple-08', 'romance-shared', BOTH, 'recentTalk', '이야기를 나누고 나니 기분이 좋아졌어.', '이야기를 나누고 나니 기분이 좋아졌어요.'),
  ...romance('mono-couple-09', 'romance-shared', BOTH, 'recentTalk', '조금 전 대화를 다시 떠올려 봤어.', '조금 전 대화를 다시 떠올려 봤어요.'),
  ...romance('mono-couple-10', 'romance-shared', BOTH, 'recentTalk', '다음에 또 이야기하고 싶어.', '다음에 또 이야기하고 싶어요.'),
]
