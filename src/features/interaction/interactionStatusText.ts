import type { CharacterInteractionSession } from './characterInteractionTypes'

/**
 * Pure text-derivation for the "현재 상호작용 상태" line shown in
 * `LiveNeedsPanel.tsx` (right alongside the existing "기분: …" text, per the
 * spec's own "기존 욕구·기분 UI와 자연스럽게 공존해야 함"). Reads only the two
 * stores that actually track a live interaction — `dialogueStore`'s
 * `activeConversations` for `talk` (which has no session of its own here,
 * since it delegates entirely to the existing dialogue engine — see
 * `characterInteractionTrigger.ts`'s own top comment) and this feature's own
 * `characterInteractionStore` for the other four kinds. Never guesses from
 * movement status alone (a `'seated'` character might just be using a chair
 * solo via the pre-existing furniture-interaction system, not `sitTogether`).
 */
export function describeInteractionStatus(
  characterId: string,
  nameById: Record<string, string>,
  activeConversations: Record<string, string[]>,
  sessions: Record<string, CharacterInteractionSession>,
  byCharacterId: Record<string, string>,
): string | null {
  for (const participants of Object.values(activeConversations)) {
    if (!participants.includes(characterId)) continue
    const partnerId = participants.find((id) => id !== characterId)
    const partnerName = partnerId ? nameById[partnerId] : undefined
    return partnerName ? `${partnerName}와 대화 중` : '대화 중'
  }

  const sessionId = byCharacterId[characterId]
  const session = sessionId ? sessions[sessionId] : undefined
  if (!session) return null

  const partnerId = session.characterAId === characterId ? session.characterBId : session.characterAId
  const partnerName = nameById[partnerId]

  switch (session.type) {
    case 'stayTogether':
      return partnerName ? `${partnerName}와 같이 쉬는 중` : '같이 쉬는 중'
    case 'sitTogether':
      return partnerName ? `${partnerName}와 같이 앉아 있어요` : '같이 앉아 있어요'
    case 'hug':
      return partnerName ? `${partnerName}를 안아주고 있어요` : '안아주고 있어요'
    case 'holdHands':
      return partnerName ? `${partnerName}와 손잡고 있어요` : '손잡고 있어요'
    default:
      return null
  }
}
