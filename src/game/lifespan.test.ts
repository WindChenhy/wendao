import { describe, expect, it } from 'vitest'
import { breakthroughLifespan } from './lifespan'

describe('R-20 突破延寿（寿元是消耗品，只延长不回补）', () => {
  it('小境界突破：仍在同一大境，不延寿', () => {
    expect(breakthroughLifespan(80, 'qi', 'qi')).toBe(80)
  })

  it('大境界突破：剩余寿元 + 两境满寿元之差，已耗去的寿元不返还', () => {
    // 练气满寿 120 → 筑基满寿 240：增量 120
    expect(breakthroughLifespan(100, 'qi', 'foundation')).toBe(220)
    // 油尽灯枯时突破也只补增量，不会回满到 240
    expect(breakthroughLifespan(5, 'qi', 'foundation')).toBe(125)
  })

  it('规则倍率（DLC 寿元乘数）作用于增量', () => {
    expect(breakthroughLifespan(100, 'qi', 'foundation', 0.5)).toBe(160)
  })

  it('飞升：给足仙寿（终局数量级特殊处理）', () => {
    expect(breakthroughLifespan(30, 'tribulation', 'ascended')).toBe(999999)
  })

  it('剩余寿元异常为负时收敛为 0 再加增量', () => {
    expect(breakthroughLifespan(-50, 'qi', 'foundation')).toBe(120)
  })
})
