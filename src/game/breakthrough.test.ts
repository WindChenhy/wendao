import { describe, expect, it } from 'vitest'
import { attemptBreakthrough, breakthroughRate } from './breakthrough'

describe('突破成败与文案一致', () => {
  it('加成后成功率与文案共用同一 rate（回归：成功却打失败日志）', () => {
    const base = breakthroughRate('sword', 'spirit_sea')
    const finalRate = 81
    // roll 落在 base 与 finalRate 之间：旧逻辑会「成功升级 + 失败文案」
    const roll = Math.min(80, Math.max(base + 5, 70))
    expect(roll).toBeLessThan(finalRate)
    expect(roll).toBeGreaterThan(base)

    const r = attemptBreakthrough('sword', 'spirit_sea', 5, roll, finalRate)
    expect(r.success).toBe(true)
    expect(r.message).not.toContain('失败')
    expect(r.rate).toBe(finalRate)
  })

  it('roll 超过最终 rate 则失败，文案为失败', () => {
    const r = attemptBreakthrough('sword', 'spirit_sea', 5, 90, 81)
    expect(r.success).toBe(false)
    expect(r.message).toContain('失败')
  })

  it('roll 低于最终 rate 成功，文案为成功', () => {
    const r = attemptBreakthrough('sword', 'spirit_sea', 5, 10, 81)
    expect(r.success).toBe(true)
    expect(r.severity).toBe('none')
  })
})
