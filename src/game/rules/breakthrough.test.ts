import { describe, expect, it } from 'vitest'
import {
  BREAKTHROUGH_RATE_MAX,
  BREAKTHROUGH_RATE_MIN,
  breakthroughSuccessRate,
} from './breakthrough'

/** 剑修/练气：基础 75 + 职业 2 = 77（未触碰基础层 5..92 钳制） */
const SWORD_QI = { classId: 'sword' as const, realm: 'qi' as const }

describe('breakthroughSuccessRate', () => {
  it('无任何加成时等于基础率（可选字段缺省按 0 处理）', () => {
    expect(breakthroughSuccessRate(SWORD_QI)).toBe(77)
  })

  it('加成过高时钳制到上限 95', () => {
    const rate = breakthroughSuccessRate({
      ...SWORD_QI,
      sectBonus: 10,
      spouseBonus: 5,
      daoBonus: 10,
      treasureBonus: 8,
      pillBonus: 20,
      tribTokenBonus: 5,
      synergyBonus: 10,
      planRateDelta: 10,
      rulesRateDelta: 5,
    })
    expect(rate).toBe(BREAKTHROUGH_RATE_MAX)
    expect(rate).toBe(95)
  })

  it('加成为负时钳制到下限 5', () => {
    const rate = breakthroughSuccessRate({
      ...SWORD_QI,
      synergyBonus: -50,
      planRateDelta: -30,
      rulesRateDelta: -10,
    })
    expect(rate).toBe(BREAKTHROUGH_RATE_MIN)
    expect(rate).toBe(5)
  })

  it('各加成按线性加算聚合（77+2+3+1+4+5=92，与手算一致）', () => {
    const base = {
      ...SWORD_QI,
      sectBonus: 2,
      spouseBonus: 3,
      daoBonus: 1,
      treasureBonus: 4,
      pillBonus: 5,
    }
    // 92：线性加算（若误用乘算 77×1.15≈88.6 则不匹配）
    expect(breakthroughSuccessRate(base)).toBe(92)
  })

  it('天劫方案 plan 修正生效（未越界时精确增减）', () => {
    const base = {
      ...SWORD_QI,
      sectBonus: 2,
      spouseBonus: 3,
      daoBonus: 1,
      treasureBonus: 4,
      pillBonus: 5,
    }
    expect(breakthroughSuccessRate({ ...base, planRateDelta: -8 })).toBe(84)
    expect(breakthroughSuccessRate({ ...base, planRateDelta: 3 })).toBe(95)
  })
})
