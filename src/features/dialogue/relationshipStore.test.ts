import { beforeEach, describe, expect, it } from 'vitest'
import { useRelationshipStore } from './relationshipStore'

describe('relationshipStore', () => {
  beforeEach(() => {
    useRelationshipStore.setState({ defaultRelationshipType: 'close', relationshipsByPair: {} })
  })

  it('defaults every pair to close until set explicitly', () => {
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('close')
  })

  it('setRelationshipType only affects the given pair, independent of other pairs', () => {
    useRelationshipStore.getState().setRelationshipType('a', 'b', 'romantic')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('romantic')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'c')).toBe('close')
    expect(useRelationshipStore.getState().getRelationshipType('b', 'c')).toBe('close')
  })

  it('getRelationshipType is order-independent', () => {
    useRelationshipStore.getState().setRelationshipType('b', 'a', 'rival')
    expect(useRelationshipStore.getState().getRelationshipType('a', 'b')).toBe('rival')
  })

  it('merge falls back to the default when old saved data is missing every field', () => {
    const merge = useRelationshipStore.persist.getOptions().merge!
    const merged = merge({}, useRelationshipStore.getState()) as {
      defaultRelationshipType: string
      relationshipsByPair: Record<string, string>
    }
    expect(merged.defaultRelationshipType).toBe('close')
    expect(merged.relationshipsByPair).toEqual({})
  })

  it('migrates a pre-5-character save (single global relationshipType) into defaultRelationshipType', () => {
    const merge = useRelationshipStore.persist.getOptions().merge!
    const merged = merge({ relationshipType: 'romantic' }, useRelationshipStore.getState()) as {
      defaultRelationshipType: string
    }
    expect(merged.defaultRelationshipType).toBe('romantic')
  })

  it('merge falls back to the default when the saved value is not a known type', () => {
    const merge = useRelationshipStore.persist.getOptions().merge!
    const merged = merge({ relationshipType: 'not-a-real-type' }, useRelationshipStore.getState()) as {
      defaultRelationshipType: string
    }
    expect(merged.defaultRelationshipType).toBe('close')
  })

  it('preserves per-pair overrides across a merge, dropping any invalid entries', () => {
    const merge = useRelationshipStore.persist.getOptions().merge!
    const merged = merge(
      { defaultRelationshipType: 'close', relationshipsByPair: { 'a|b': 'family', 'c|d': 'not-a-real-type' } },
      useRelationshipStore.getState(),
    ) as { relationshipsByPair: Record<string, string> }
    expect(merged.relationshipsByPair).toEqual({ 'a|b': 'family' })
  })
})
