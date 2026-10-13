import { describe, expect, it } from 'vitest'
import { TREASURE_BREAKTHROUGH_CAP, treasureBreakthroughTotal } from './combatStats'
import { TREASURE_BONUS } from '../data/items'

describe('突破法宝加成封顶（SPRINT B R-09）', () => {
  const withBt = Object.entries(TREASURE_BONUS)
    .filter(([, b]) => (b.breakthrough ?? 0) > 0)
    .map(([id]) => id)

  it('数据侧确实存在可堆到上限的突破法宝（否则本测试无意义）', () => {
    expect(withBt.length).toBeGreaterThanOrEqual(3)
    const raw = withBt.reduce((n, id) => n + (TREASURE_BONUS[id].breakthrough ?? 0), 0)
    expect(raw).toBeGreaterThan(TREASURE_BREAKTHROUGH_CAP)
  })

  it('满配逐件相加后整体封顶，不再把「渡劫 6%」抹平', () => {
    expect(treasureBreakthroughTotal(withBt)).toBe(TREASURE_BREAKTHROUGH_CAP)
  })

  it('未超上限时按原值返回；同类只计一件', () => {
    const [id, bonus] = Object.entries(TREASURE_BONUS).find(([, b]) => (b.breakthrough ?? 0) > 0)!
    expect(treasureBreakthroughTotal([id])).toBe(bonus.breakthrough)
    expect(treasureBreakthroughTotal([id, id, id])).toBe(bonus.breakthrough)
    expect(treasureBreakthroughTotal([])).toBe(0)
  })
})
