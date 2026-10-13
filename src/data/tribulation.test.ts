import { describe, expect, it } from 'vitest'
import {
  CALAMITIES,
  TRIBULATION_PLANS,
  calamityById,
  calamityCountFor,
  calamityLogText,
  calamitySolutionBonus,
  drawCalamities,
  isTribulationMoment,
  tribulationPlan,
  type DrawnCalamity,
} from './tribulation'
import { REALM_ORDER } from './realms'

/** 天劫方案只属于大乘/渡劫（SPRINT B R-11） */
describe('isTribulationMoment 境界范围', () => {
  it('仅大乘与渡劫两境成立', () => {
    const expected = new Set(['mahayana', 'tribulation'])
    for (const realm of REALM_ORDER) {
      expect(isTribulationMoment(realm), `${realm} 的天劫判定不符`).toBe(expected.has(realm))
    }
  })

  it('练气满层冲关不再弹天劫方案（此前 layer>=maxLayers 会放行）', () => {
    expect(isTribulationMoment('qi')).toBe(false)
    expect(isTribulationMoment('foundation')).toBe(false)
    expect(isTribulationMoment('golden_core')).toBe(false)
    expect(isTribulationMoment('integration')).toBe(false)
  })

  it('方案表齐备且「常规」为零修正基准', () => {
    expect(TRIBULATION_PLANS.length).toBeGreaterThanOrEqual(4)
    expect(tribulationPlan('normal').rateDelta).toBe(0)
    expect(tribulationPlan('force').rateDelta).toBeLessThan(0)
    expect(tribulationPlan('unknown' as never).id).toBe(tribulationPlan('normal').id)
  })
})

/** R-28 三灾/心魔劫抽劫机制 */
describe('R-28 抽劫', () => {
  it('劫类型表齐备：雷/火/风/心魔四类，各带解法', () => {
    expect(CALAMITIES.map((c) => c.id).sort()).toEqual(['feng', 'huo', 'lei', 'xinmo'])
    for (const c of CALAMITIES) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.desc.length).toBeGreaterThan(0)
      expect(c.solutionItemId, `${c.id} 缺解法道具`).toBeTruthy()
      expect((c.rateDelta ?? 0) > 0, `${c.id} 解法加成应为正`).toBe(true)
    }
    expect(calamityById('lei')?.name).toBe('雷灾')
    expect(calamityById('nope' as never)).toBeNull()
  })

  it('抽劫数目随境界递增：低境 1、化神 2、大乘 3', () => {
    expect(calamityCountFor('qi')).toBe(1)
    expect(calamityCountFor('golden_core')).toBe(1)
    expect(calamityCountFor('spirit_sea')).toBe(2)
    expect(calamityCountFor('integration')).toBe(2)
    expect(calamityCountFor('mahayana')).toBe(3)
  })

  it('低境界只抽三灾，不出现心魔劫', () => {
    const drawn = drawCalamities('qi', 0, () => 0)
    expect(drawn.length).toBe(1)
    expect(drawn.some((c) => c.id === 'xinmo')).toBe(false)
    for (const c of drawn) {
      expect(['lei', 'huo', 'feng']).toContain(c.id)
    }
  })

  it('化神起掺入心魔劫；心魔值 ≥60 时心魔劫必中且置顶', () => {
    // 化神、心魔 0：候选池含心魔劫
    const mid = drawCalamities('spirit_sea', 0, () => 0.99)
    expect(mid.length).toBe(2)
    // 心魔深重：心魔劫必定入池且为第一项
    const heavy = drawCalamities('integration', 60, () => 0.99)
    expect(heavy[0].id).toBe('xinmo')
    expect(heavy.some((c) => c.id === 'xinmo')).toBe(true)
  })

  it('抽劫不重复（注入 rng 走确定性）', () => {
    const drawn = drawCalamities('mahayana', 0, () => 0.5)
    expect(drawn.length).toBe(3)
    const ids = drawn.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('解法道具汇总：持有者计入 rateDelta，未持有不加分', () => {
    const withSol: DrawnCalamity[] = [
      { def: calamityById('lei')!, hasSolution: true },
      { def: calamityById('huo')!, hasSolution: false },
    ]
    expect(calamitySolutionBonus(withSol)).toBe(calamityById('lei')!.rateDelta)
    expect(
      calamitySolutionBonus([
        { def: calamityById('lei')!, hasSolution: false },
        { def: calamityById('huo')!, hasSolution: false },
      ]),
    ).toBe(0)
  })

  it('抽劫日志点名所渡之劫与解法', () => {
    const drawn: DrawnCalamity[] = [
      { def: calamityById('lei')!, hasSolution: true },
      { def: calamityById('xinmo')!, hasSolution: false },
    ]
    const txt = calamityLogText(drawn)
    expect(txt).toContain('雷灾')
    expect(txt).toContain('护持')
    expect(txt).toContain('心魔劫')
    expect(txt).toContain('可解')
  })
})
