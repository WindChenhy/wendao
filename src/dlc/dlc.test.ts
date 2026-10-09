import { describe, expect, it } from 'vitest'
import { combineRules, type DlcPack, type RuntimeRules } from './types'
import { BUILTIN_DLC } from './builtin'
import type { WorldEvent } from '../data/events'

const fakeEvent: WorldEvent = {
  id: 'fake_1',
  type: 'fortune',
  title: '假事件',
  text: '仅用于测试的占位事件。',
  actions: [{ id: 'claim', label: '收取' }],
}

/** 两个最小数据包：只带数值与事件，不依赖内置内容 */
const fakePacks: DlcPack[] = [
  {
    manifest: { id: 't_a', name: '包A', version: '0.0.1', desc: '', features: [] },
    balance: { cultivateMul: 2, breakthroughRateDelta: 3 },
    extraEvents: [fakeEvent],
  },
  {
    manifest: { id: 't_b', name: '包B', version: '0.0.1', desc: '', features: [] },
    balance: { cultivateMul: 3, lifespanMul: 0.5, exploreStoneMul: 1.5, breakthroughRateDelta: -1 },
    extraEvents: [fakeEvent],
  },
]

describe('combineRules 合并规则', () => {
  it('空 enabledIds → 全默认值', () => {
    const rules = combineRules(BUILTIN_DLC, [])
    expect(rules).toEqual({
      cultivateMul: 1,
      breakthroughRateDelta: 0,
      lifespanMul: 1,
      exploreStoneMul: 1,
      extraEvents: [],
    } satisfies RuntimeRules)
  })

  it('多个 pack：cultivateMul/lifespanMul/exploreStoneMul 乘算，breakthroughRateDelta 加算', () => {
    const rules = combineRules(fakePacks, ['t_a', 't_b'])
    expect(rules.cultivateMul).toBe(6)
    expect(rules.breakthroughRateDelta).toBe(2)
    expect(rules.lifespanMul).toBe(0.5)
    expect(rules.exploreStoneMul).toBeCloseTo(1.5)
  })

  it('未注册 id 跳过不报错，返回默认值', () => {
    expect(combineRules(BUILTIN_DLC, ['not_registered'])).toEqual(combineRules(BUILTIN_DLC, []))
  })

  it('extraEvents 按启用顺序拼接（含最小假事件对象）', () => {
    const rules = combineRules(fakePacks, ['t_a', 't_b'])
    expect(rules.extraEvents).toHaveLength(2)
    expect(rules.extraEvents[0]).toBe(fakeEvent)
    expect(rules.extraEvents[1]).toBe(fakeEvent)
  })

  it('内置硬核 + 黑暗包合并数值', () => {
    const rules = combineRules(BUILTIN_DLC, ['hardcore', 'dark'])
    expect(rules.cultivateMul).toBeCloseTo(1.05 * 0.92)
    expect(rules.breakthroughRateDelta).toBe(-10)
    expect(rules.lifespanMul).toBeCloseTo(0.75)
    expect(rules.exploreStoneMul).toBeCloseTo(1.25)
    expect(rules.extraEvents.map((e) => e.id)).toEqual(['hc_pressure', 'hc_trial', 'dark_whisper'])
  })
})
