import type { MonologueLineDef } from './defaultMonologueLibrary'
import type { PartnerPresence } from './monologueTypes'
import type { RelationshipType } from './relationshipConfig'

/**
 * Relationship-specific monologue lines, batch 1: 친구 (10) and 친밀한 관계 (10),
 * each in hand-written 반말 and 존댓말 (40 entries). Like the 연인/부부 set they
 * are gated by a `partnerCondition` — the relationship type id plus a checkable
 * presence fact (same room / other room / just talked) — and a pair whose
 * relationship was never chosen never counts as a partner, so nobody gets a line
 * for a relationship they don't have. A line about the partner being around is
 * only ever spoken when they really share the room. No names, kinship or rank
 * terms, no invented past, nothing that hasn't happened.
 */

const FRIEND: RelationshipType[] = ['friend']
const CLOSE: RelationshipType[] = ['close']
const FAMILY: RelationshipType[] = ['family']
const RIVAL: RelationshipType[] = ['rival']
const AWKWARD: RelationshipType[] = ['awkward']

function pair(id: string, category: string, relationships: RelationshipType[], presence: PartnerPresence, casual: string, formal: string): MonologueLineDef[] {
  const base = { category, timeBands: [], personalityTags: [], activities: [], weight: 1.5, partnerCondition: { relationships, presence } }
  return [
    { ...base, id: `${id}-c`, tone: 'casual', text: casual },
    { ...base, id: `${id}-f`, tone: 'formal', text: formal },
  ]
}

export const RELATIONSHIP_MONOLOGUE_LINES: MonologueLineDef[] = [
  // ---- 친구 (10)
  ...pair('mono-friend-01', 'relationship-friend', FRIEND, 'sameRoom', '같은 방에 친구가 있으니 마음이 편해.', '같은 방에 친구가 있으니 마음이 편해요.'),
  ...pair('mono-friend-02', 'relationship-friend', FRIEND, 'sameRoom', '옆에서 각자 시간을 보내도 좋은 사이야.', '옆에서 각자 시간을 보내도 좋은 사이예요.'),
  ...pair('mono-friend-03', 'relationship-friend', FRIEND, 'sameRoom', '친구와 같은 공간에 있으면 괜히 든든해.', '친구와 같은 공간에 있으면 괜히 든든해요.'),
  ...pair('mono-friend-04', 'relationship-friend', FRIEND, 'sameRoom', '말을 걸어 볼까 잠깐 고민 중이야.', '말을 걸어 볼까 잠깐 고민 중이에요.'),
  ...pair('mono-friend-05', 'relationship-friend', FRIEND, 'otherRoom', '다른 방에 있는 친구는 지금 뭘 하고 있으려나.', '다른 방에 있는 친구는 지금 무엇을 하고 있을지 궁금해요.'),
  ...pair('mono-friend-06', 'relationship-friend', FRIEND, 'otherRoom', '조금 있다가 친구한테 가 봐야겠다.', '조금 있다가 친구에게 가 봐야겠어요.'),
  ...pair('mono-friend-07', 'relationship-friend', FRIEND, 'otherRoom', '친구가 다른 방에 있어도 같은 집에 있다는 게 좋아.', '친구가 다른 방에 있어도 같은 집에 있다는 게 좋아요.'),
  ...pair('mono-friend-08', 'relationship-friend', FRIEND, 'recentTalk', '방금 나눈 이야기가 꽤 즐거웠어.', '방금 나눈 이야기가 꽤 즐거웠어요.'),
  ...pair('mono-friend-09', 'relationship-friend', FRIEND, 'recentTalk', '친구랑 이야기하고 나니 기분이 가벼워졌어.', '친구와 이야기하고 나니 기분이 가벼워졌어요.'),
  ...pair('mono-friend-10', 'relationship-friend', FRIEND, 'recentTalk', '다음엔 내가 먼저 말을 걸어 봐야지.', '다음엔 제가 먼저 말을 걸어 봐야겠어요.'),

  // ---- 친밀한 관계 (10)
  ...pair('mono-close-01', 'relationship-close', CLOSE, 'sameRoom', '곁에 있는 것만으로도 서로 편한 사이라 좋아.', '곁에 있는 것만으로도 서로 편한 사이라 좋아요.'),
  ...pair('mono-close-02', 'relationship-close', CLOSE, 'sameRoom', '말 안 해도 통하는 것 같아서 마음이 놓여.', '말을 안 해도 통하는 것 같아서 마음이 놓여요.'),
  ...pair('mono-close-03', 'relationship-close', CLOSE, 'sameRoom', '같은 방에 있으면 괜히 표정을 살피게 돼.', '같은 방에 있으면 괜히 표정을 살피게 돼요.'),
  ...pair('mono-close-04', 'relationship-close', CLOSE, 'sameRoom', '같이 있어도 각자 편하게 있을 수 있는 사이야.', '같이 있어도 각자 편하게 있을 수 있는 사이예요.'),
  ...pair('mono-close-05', 'relationship-close', CLOSE, 'otherRoom', '다른 방에 있어도 잘 지내고 있을 것 같아.', '다른 방에 있어도 잘 지내고 있을 것 같아요.'),
  ...pair('mono-close-06', 'relationship-close', CLOSE, 'otherRoom', '조금 있다가 얼굴 보러 가야지.', '조금 있다가 얼굴 보러 가야겠어요.'),
  ...pair('mono-close-07', 'relationship-close', CLOSE, 'otherRoom', '떨어져 있어도 마음은 편한 사이라 좋아.', '떨어져 있어도 마음은 편한 사이라 좋아요.'),
  ...pair('mono-close-08', 'relationship-close', CLOSE, 'recentTalk', '솔직하게 이야기하고 나니 속이 시원해.', '솔직하게 이야기하고 나니 속이 시원해요.'),
  ...pair('mono-close-09', 'relationship-close', CLOSE, 'recentTalk', '방금 대화가 오래 마음에 남네.', '방금 대화가 오래 마음에 남네요.'),
  ...pair('mono-close-10', 'relationship-close', CLOSE, 'recentTalk', '편하게 말할 수 있는 사람이 있어서 다행이야.', '편하게 말할 수 있는 사람이 있어서 다행이에요.'),

  // ---- 가족 (10)
  ...pair('mono-family-01', 'relationship-family', FAMILY, 'sameRoom', '같은 방에 있으니 집이 더 집 같아.', '같은 방에 있으니 집이 더 집 같아요.'),
  ...pair('mono-family-02', 'relationship-family', FAMILY, 'sameRoom', '말 안 해도 옆에 있는 게 편해.', '말 안 해도 옆에 있는 게 편해요.'),
  ...pair('mono-family-03', 'relationship-family', FAMILY, 'sameRoom', '같이 있으면 괜히 마음이 놓여.', '같이 있으면 괜히 마음이 놓여요.'),
  ...pair('mono-family-04', 'relationship-family', FAMILY, 'sameRoom', '집 안에 사람 기척이 있다는 게 좋아.', '집 안에 사람 기척이 있다는 게 좋아요.'),
  ...pair('mono-family-05', 'relationship-family', FAMILY, 'otherRoom', '다른 방에 있어도 같은 집이라 든든해.', '다른 방에 있어도 같은 집이라 든든해요.'),
  ...pair('mono-family-06', 'relationship-family', FAMILY, 'otherRoom', '지금쯤 뭘 하고 있으려나.', '지금쯤 무엇을 하고 있을지 궁금해요.'),
  ...pair('mono-family-07', 'relationship-family', FAMILY, 'otherRoom', '이따 얼굴 보면 반가울 것 같아.', '이따 얼굴을 보면 반가울 것 같아요.'),
  ...pair('mono-family-08', 'relationship-family', FAMILY, 'recentTalk', '방금 나눈 이야기가 편안했어.', '방금 나눈 이야기가 편안했어요.'),
  ...pair('mono-family-09', 'relationship-family', FAMILY, 'recentTalk', '별 얘기 아니었는데도 마음이 따뜻해졌어.', '별 얘기 아니었는데도 마음이 따뜻해졌어요.'),
  ...pair('mono-family-10', 'relationship-family', FAMILY, 'recentTalk', '이런 사소한 대화가 하루를 채워 주는 것 같아.', '이런 사소한 대화가 하루를 채워 주는 것 같아요.'),

  // ---- 라이벌 (10)
  ...pair('mono-rival-01', 'relationship-rival', RIVAL, 'sameRoom', '같은 방에 있으니까 괜히 긴장돼.', '같은 방에 있으니까 괜히 긴장돼요.'),
  ...pair('mono-rival-02', 'relationship-rival', RIVAL, 'sameRoom', '저쪽이 있으면 나도 모르게 자세를 고쳐 앉게 돼.', '저쪽이 있으면 저도 모르게 자세를 고쳐 앉게 돼요.'),
  ...pair('mono-rival-03', 'relationship-rival', RIVAL, 'sameRoom', '방심할 수 없는 상대가 가까이 있어.', '방심할 수 없는 상대가 가까이 있어요.'),
  ...pair('mono-rival-04', 'relationship-rival', RIVAL, 'sameRoom', '지지 않으려면 정신 바짝 차려야지.', '지지 않으려면 정신을 바짝 차려야겠어요.'),
  ...pair('mono-rival-05', 'relationship-rival', RIVAL, 'otherRoom', '다른 방에 있어도 신경이 그쪽으로 가.', '다른 방에 있어도 신경이 그쪽으로 가요.'),
  ...pair('mono-rival-06', 'relationship-rival', RIVAL, 'otherRoom', '지금은 뭘 하고 있을지 괜히 궁금해.', '지금은 무엇을 하고 있을지 괜히 궁금해요.'),
  ...pair('mono-rival-07', 'relationship-rival', RIVAL, 'otherRoom', '떨어져 있어도 긴장이 안 풀려.', '떨어져 있어도 긴장이 안 풀려요.'),
  ...pair('mono-rival-08', 'relationship-rival', RIVAL, 'recentTalk', '방금 나눈 말이 자꾸 떠올라.', '방금 나눈 말이 자꾸 떠올라요.'),
  ...pair('mono-rival-09', 'relationship-rival', RIVAL, 'recentTalk', '이번엔 내가 좀 밀린 것 같아, 다음엔 안 봐줘야지.', '이번엔 제가 조금 밀린 것 같아요, 다음엔 안 봐줘야겠어요.'),
  ...pair('mono-rival-10', 'relationship-rival', RIVAL, 'recentTalk', '그래도 그 말싸움, 은근히 재밌었어.', '그래도 그 말씨름, 은근히 재밌었어요.'),

  // ---- 어색한 사이 (10)
  ...pair('mono-awkward-01', 'relationship-awkward', AWKWARD, 'sameRoom', '같은 방에 있으니까 괜히 신경 쓰여.', '같은 방에 있으니까 괜히 신경 쓰여요.'),
  ...pair('mono-awkward-02', 'relationship-awkward', AWKWARD, 'sameRoom', '먼저 말 걸어 볼까, 조금 망설여져.', '먼저 말을 걸어 볼까, 조금 망설여져요.'),
  ...pair('mono-awkward-03', 'relationship-awkward', AWKWARD, 'sameRoom', '아직은 무슨 말을 해야 할지 잘 모르겠어.', '아직은 무슨 말을 해야 할지 잘 모르겠어요.'),
  ...pair('mono-awkward-04', 'relationship-awkward', AWKWARD, 'sameRoom', '그래도 조금씩 덜 불편해지는 것 같아.', '그래도 조금씩 덜 불편해지는 것 같아요.'),
  ...pair('mono-awkward-05', 'relationship-awkward', AWKWARD, 'otherRoom', '다른 방에 있으니 조금 마음이 놓이네.', '다른 방에 있으니 조금 마음이 놓이네요.'),
  ...pair('mono-awkward-06', 'relationship-awkward', AWKWARD, 'otherRoom', '다음에 마주치면 뭐라고 인사할지 생각 중이야.', '다음에 마주치면 뭐라고 인사할지 생각 중이에요.'),
  ...pair('mono-awkward-07', 'relationship-awkward', AWKWARD, 'otherRoom', '조금씩 편해지고는 있는 것 같아.', '조금씩 편해지고는 있는 것 같아요.'),
  ...pair('mono-awkward-08', 'relationship-awkward', AWKWARD, 'recentTalk', '방금 대화, 생각보다 어색하지 않았어.', '방금 대화, 생각보다 어색하지 않았어요.'),
  ...pair('mono-awkward-09', 'relationship-awkward', AWKWARD, 'recentTalk', '몇 마디 나눴을 뿐인데 마음이 조금 편해졌어.', '몇 마디 나눴을 뿐인데 마음이 조금 편해졌어요.'),
  ...pair('mono-awkward-10', 'relationship-awkward', AWKWARD, 'recentTalk', '다음엔 조금 더 자연스럽게 이야기해 봐야지.', '다음엔 조금 더 자연스럽게 이야기해 봐야겠어요.'),
]
