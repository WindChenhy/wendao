import { describe, expect, it } from 'vitest'
import {
  buildingAtkMul,
  buildingUpgradeCost,
  buildingCraftRateBonus,
  buildingCultivateMul,
  commissionPoolCutOf,
  stonesToPool,
  DONATE_STONES_PER_POOL,
  COMMISSION_POOL_CUT,
  SECT_BUILDING_MAP,
} from '../data/sectBuildings'

describe('宗门建筑与贡献池', () => {
  it('升级费用随级递增', () => {
    const def = SECT_BUILDING_MAP.spirit_vein
    expect(buildingUpgradeCost(def, 0)).toBe(400)
    expect(buildingUpgradeCost(def, 1)).toBeGreaterThan(400)
  })

  it('灵脉/丹房/剑冢效果随级', () => {
    expect(buildingCultivateMul({ spirit_vein: 2 })).toBeCloseTo(1.06)
    expect(buildingCraftRateBonus({ alchemy_lab: 3 })).toBeCloseTo(6)
    expect(buildingAtkMul({ sword_grave: 1 })).toBeCloseTo(1.02)
    expect(buildingAtkMul({ sword_grave: 1 }, { isExam: true })).toBeCloseTo(1.03)
  })

  it('捐献与委托抽成', () => {
    expect(DONATE_STONES_PER_POOL).toBe(10)
    expect(COMMISSION_POOL_CUT).toBeCloseTo(0.1)
    expect(stonesToPool(99)).toBe(9)
    expect(commissionPoolCutOf(55)).toBe(5)
  })
})
