import { describe, expect, it } from 'vitest'
import {
  atonementCost,
  clampWanted,
  marketPremiumMul,
  marketPriceOf,
  wantedHuntChance,
  wantedLabel,
  WANTED_MAX,
} from './bounty'
import {
  isDemonicChampion,
  isRighteousParagon,
  reputationTitles,
  REP_MARKET_DISCOUNT,
  REP_TASK_CONTRIB_MUL,
} from './reputation'

describe('clampWanted', () => {
  it('夹在 0–5 之间且取整', () => {
    expect(clampWanted(-3)).toBe(0)
    expect(clampWanted(0)).toBe(0)
    expect(clampWanted(2.9)).toBe(2)
    expect(clampWanted(9)).toBe(WANTED_MAX)
  })
})

describe('wantedHuntChance', () => {
  it('通缉 <2 不触发追杀，≥2 固定 15%', () => {
    expect(wantedHuntChance(0)).toBe(0)
    expect(wantedHuntChance(1)).toBe(0)
    expect(wantedHuntChance(2)).toBe(0.15)
    expect(wantedHuntChance(5)).toBe(0.15)
  })
})

describe('marketPremiumMul / marketPriceOf', () => {
  it('通缉 ≥4 才溢价 20%', () => {
    expect(marketPremiumMul(3)).toBe(1)
    expect(marketPremiumMul(4)).toBe(1.2)
  })

  it('成交价 = 基础价 × 溢价 × 名宿折扣，向下取整且 ≥1', () => {
    // 无通缉无名宿：原价
    expect(marketPriceOf(100, { wanted: 0, repRight: 0 })).toBe(100)
    // 通缉 4：+20%
    expect(marketPriceOf(100, { wanted: 4, repRight: 0 })).toBe(120)
    // 正道名宿：九折
    expect(marketPriceOf(100, { wanted: 0, repRight: 100 })).toBe(90)
    // 叠加：120 × 0.9 = 108
    expect(marketPriceOf(100, { wanted: 4, repRight: 100 })).toBe(108)
    expect(marketPriceOf(1, { wanted: 4, repRight: 0 })).toBeGreaterThanOrEqual(1)
  })
})

describe('atonementCost', () => {
  it('随通缉档与境界上浮', () => {
    expect(atonementCost(0, 'qi')).toBe(0)
    expect(atonementCost(1, 'qi')).toBe(200)
    expect(atonementCost(2, 'qi')).toBe(400)
    expect(atonementCost(1, 'mahayana')).toBe(200 * (1 + 7 * 0.5))
    expect(atonementCost(2, 'mahayana')).toBeGreaterThan(atonementCost(1, 'mahayana'))
  })
})

describe('wantedLabel', () => {
  it('0 为空串，1–5 为罗马数字', () => {
    expect(wantedLabel(0)).toBe('')
    expect(wantedLabel(1)).toBe('Ⅰ')
    expect(wantedLabel(5)).toBe('Ⅴ')
  })
})

describe('reputationTitles', () => {
  it('未达 100 无称号', () => {
    expect(reputationTitles(99, 99)).toEqual({ righteous: null, demonic: null })
  })

  it('正魔称号可同时持有', () => {
    const t = reputationTitles(150, 120)
    expect(t.righteous).toBe('正道名宿')
    expect(t.demonic).toBe('魔道魁首')
  })

  it('档位判定与常量一致', () => {
    expect(isRighteousParagon(100)).toBe(true)
    expect(isDemonicChampion(99)).toBe(false)
    expect(REP_MARKET_DISCOUNT).toBe(0.9)
    expect(REP_TASK_CONTRIB_MUL).toBe(1.1)
  })
})
