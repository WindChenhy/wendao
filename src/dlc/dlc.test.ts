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
    balance: { cultivateMul: 2, breakthroughRateDelta: 3, petExpMul: 1.5 },
    extraEvents: [fakeEvent],
  },
  {
    manifest: { id: 't_b', name: '包B', version: '0.0.1', desc: '', features: [] },
    balance: {
      cultivateMul: 3,
      lifespanMul: 0.5,
      exploreStoneMul: 1.5,
      breakthroughRateDelta: -1,
      dailyRewardMul: 1.1,
      favorMul: 1.3,
    },
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
      petExpMul: 1,
      dailyRewardMul: 1,
      favorMul: 1,
      extraEvents: [],
      enabledIds: [],
    } satisfies RuntimeRules)
  })

  it('多个 pack：乘算项相乘、加算项相加、记录 enabledIds', () => {
    const rules = combineRules(fakePacks, ['t_a', 't_b'])
    expect(rules.cultivateMul).toBe(6)
    expect(rules.breakthroughRateDelta).toBe(2)
    expect(rules.lifespanMul).toBe(0.5)
    expect(rules.exploreStoneMul).toBeCloseTo(1.5)
    expect(rules.petExpMul).toBe(1.5)
    expect(rules.dailyRewardMul).toBeCloseTo(1.1)
    expect(rules.favorMul).toBeCloseTo(1.3)
    expect(rules.enabledIds).toEqual(['t_a', 't_b'])
  })

  it('未注册 id 跳过不报错：数值保持默认，仅记录 enabledIds', () => {
    const rules = combineRules(BUILTIN_DLC, ['not_registered'])
    expect(rules.cultivateMul).toBe(1)
    expect(rules.breakthroughRateDelta).toBe(0)
    expect(rules.extraEvents).toHaveLength(0)
    expect(rules.enabledIds).toEqual(['not_registered'])
  })

  it('extraEvents 按启用顺序拼接（含最小假事件对象）', () => {
    const rules = combineRules(fakePacks, ['t_a', 't_b'])
    expect(rules.extraEvents).toHaveLength(2)
    expect(rules.extraEvents[0]).toBe(fakeEvent)
    expect(rules.extraEvents[1]).toBe(fakeEvent)
  })

  it('内置 5 包合并数值：hardcore + dark + 3 个新包', () => {
    const ids = BUILTIN_DLC.map((p) => p.manifest.id)
    expect(ids).toEqual(['hardcore', 'dark', 'demonic_war', 'beast_taming', 'immortal_relic'])
    const rules = combineRules(BUILTIN_DLC, ids)
    expect(rules.cultivateMul).toBeCloseTo(1.05 * 0.92)
    expect(rules.breakthroughRateDelta).toBe(-8 - 2 - 3)
    expect(rules.lifespanMul).toBeCloseTo(0.75)
    expect(rules.exploreStoneMul).toBeCloseTo(1.25 * 1.2)
    expect(rules.petExpMul).toBe(1.5)
    expect(rules.dailyRewardMul).toBeCloseTo(1.1)
    expect(rules.favorMul).toBeCloseTo(1.3)
    // v1.4 数据化：内置包不再携带 extraEvents，事件入 events.json（dlcId 过滤）
    expect(rules.extraEvents).toHaveLength(0)
  })
})
