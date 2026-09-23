import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NeedsStatusPanel } from './NeedsStatusPanel'
import { useNeedsStore } from './needsStore'

describe('NeedsStatusPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useNeedsStore.setState({ byId: {} })
  })

  afterEach(() => {
    cleanup()
  })

  it('상태 섹션과 네 가지 게이지, 기분 문구를 표시한다', () => {
    useNeedsStore.getState().setNeeds('a', { hunger: 90, energy: 90, fun: 90, social: 90 })
    render(<NeedsStatusPanel characterId="a" />)

    expect(screen.getByText('상태')).toBeInTheDocument()
    expect(screen.getByText('배고픔')).toBeInTheDocument()
    expect(screen.getByText('기력')).toBeInTheDocument()
    expect(screen.getByText('즐거움')).toBeInTheDocument()
    expect(screen.getByText('교류')).toBeInTheDocument()
    expect(screen.getByText(/기분:/)).toBeInTheDocument()
  })

  it('욕구 기록이 없는 캐릭터를 열어도 자동으로 기본값을 만들어 표시한다 (self-heal)', () => {
    render(<NeedsStatusPanel characterId="new-char" />)
    expect(useNeedsStore.getState().byId['new-char']).toBeDefined()
  })

  it('energy가 매우 낮으면 "피곤해요" 기분이 표시된다', () => {
    useNeedsStore.getState().setNeeds('a', { hunger: 90, energy: 5, fun: 90, social: 90 })
    render(<NeedsStatusPanel characterId="a" />)
    expect(screen.getByText('기분: 피곤해요')).toBeInTheDocument()
  })

  it('게이지는 실제 욕구값에 비례한 progressbar로 렌더링된다', () => {
    useNeedsStore.getState().setNeeds('a', { hunger: 42, energy: 90, fun: 90, social: 90 })
    render(<NeedsStatusPanel characterId="a" />)
    expect(screen.getByRole('progressbar', { name: '배고픔' })).toHaveAttribute('aria-valuenow', '42')
  })
})
