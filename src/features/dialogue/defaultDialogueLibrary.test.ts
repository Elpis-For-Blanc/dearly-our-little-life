import { describe, expect, it } from 'vitest'
import { DEFAULT_DIALOGUE_BUNDLES } from './defaultDialogueLibrary'
import { DEFAULT_SITUATION_CATEGORIES } from './situationCategories'
import { RELATIONSHIP_TYPE_ORDER } from './relationshipConfig'

const VALID_CATEGORY_IDS = new Set(DEFAULT_SITUATION_CATEGORIES.map((c) => c.id))

describe('DEFAULT_DIALOGUE_BUNDLES structural integrity', () => {
  it('has a substantial amount of content', () => {
    expect(DEFAULT_DIALOGUE_BUNDLES.length).toBeGreaterThanOrEqual(25)
  })

  it('every bundle has a unique id', () => {
    const ids = DEFAULT_DIALOGUE_BUNDLES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every bundle references a real, registered situation category', () => {
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      expect(VALID_CATEGORY_IDS.has(bundle.categoryId), `bundle ${bundle.id} references unknown category ${bundle.categoryId}`).toBe(true)
    }
  })

  it('never authors content in the auto-excluded conflict/reconciliation categories (no tracked prior-conflict state to make that coherent)', () => {
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      expect(['conflict', 'reconciliation']).not.toContain(bundle.categoryId)
    }
  })

  it('every bundle has 1-4 turns, alternating or at least never leaving a turn with an invalid speaker', () => {
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      expect(bundle.turns.length).toBeGreaterThanOrEqual(1)
      expect(bundle.turns.length).toBeLessThanOrEqual(4)
      for (const turn of bundle.turns) {
        expect(['first', 'second']).toContain(turn.speaker)
      }
    }
  })

  it('every turn has a non-empty hand-authored formal AND casual variant (never derived by string manipulation)', () => {
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      for (const turn of bundle.turns) {
        expect(turn.text.formal.trim().length, `${bundle.id} formal text empty`).toBeGreaterThan(0)
        expect(turn.text.casual.trim().length, `${bundle.id} casual text empty`).toBeGreaterThan(0)
        // The two variants must actually differ — otherwise it isn't a real tone distinction.
        expect(turn.text.formal).not.toBe(turn.text.casual)
      }
    }
  })

  it('every romantic-flagged bundle is restricted to romantic relationship types (연인 and/or 부부), so it can never be selected for any other pair', () => {
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      if (!bundle.romantic) continue
      expect(bundle.relationshipTypes, `${bundle.id} is romantic but has no relationshipTypes restriction`).toBeDefined()
      for (const type of bundle.relationshipTypes ?? []) expect(['romantic', 'married']).toContain(type)
    }
  })

  it('any declared relationshipTypes restriction only ever names real relationship types', () => {
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      if (!bundle.relationshipTypes) continue
      for (const type of bundle.relationshipTypes) {
        expect(RELATIONSHIP_TYPE_ORDER).toContain(type)
      }
    }
  })

  it('never uses a specific family-role address term (only appropriate when the user has set one) — spot-checks common Korean role words', () => {
    const forbiddenWords = ['오빠', '언니', '누나', '형', '자기야', '여보', '아빠', '엄마']
    for (const bundle of DEFAULT_DIALOGUE_BUNDLES) {
      for (const turn of bundle.turns) {
        for (const word of forbiddenWords) {
          expect(turn.text.formal, `${bundle.id} formal text uses "${word}"`).not.toContain(word)
          expect(turn.text.casual, `${bundle.id} casual text uses "${word}"`).not.toContain(word)
        }
      }
    }
  })

  it('covers every category the spec explicitly named, at least once', () => {
    const requiredCategories = [
      'morning-greeting',
      'wake-up',
      'breakfast',
      'lunch',
      'afternoon-chat',
      'snack',
      'dinner',
      'day-wrap-up',
      'pre-bedtime',
      'bedtime',
      'encounter',
      'casual-chat',
      'resting-together',
      'worried',
      'comfort',
      'teasing',
      'compliment',
      'favor',
      'gratitude',
      'apology',
      'reconciliation', // intentionally NOT covered by any bundle — see the exclusion test above
    ]
    const coveredCategories = new Set(DEFAULT_DIALOGUE_BUNDLES.map((b) => b.categoryId))
    for (const category of requiredCategories) {
      if (category === 'reconciliation') {
        expect(coveredCategories.has(category)).toBe(false)
        continue
      }
      expect(coveredCategories.has(category), `no default bundle covers category "${category}"`).toBe(true)
    }
  })
})
