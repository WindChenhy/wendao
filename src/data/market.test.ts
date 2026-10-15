import { describe, expect, it } from 'vitest'
import {
  ITEMS,
  MARKET_STOCK,
  itemCategory,
  itemUsageHint,
  itemUsageRealm,
  itemUsableAt,
  marketStock,
} from './items'

/**
 * 口径（用户拍板）：**境界只约束「使用」，不约束「买卖」**。
 * 坊市货架不再按境界隐藏/灰锁，任何境界都能买；售卖同样不限境界（见 store 层测试）。
 */
describe('坊市买卖不限境界（境界只约束使用）', () => {
  it('每个分区的货架覆盖全部在售货物，且与境界无关', () => {
    for (const tab of ['pill', 'herb', 'material', 'gongfa', 'treasure'] as const) {
      const ids = marketStock(tab)
      expect(ids.length, `${tab} 分区不应为空`).toBeGreaterThan(0)
      for (const id of ids) {
        expect(itemCategory(id), `${id} 分类与分区 ${tab} 不符`).toBe(tab)
        expect(ITEMS[id], `${id} 缺少物品定义`).toBeDefined()
      }
    }
    // 法宝分区覆盖全部 25 件在售法宝（不再按境界隐藏）
    const treasureTabs = marketStock('treasure')
    expect(treasureTabs.length).toBe(MARKET_STOCK.treasure.length)
    // 全部 = 各分区并集（去重）
    const all = new Set(marketStock('all'))
    for (const tab of ['pill', 'herb', 'material', 'gongfa', 'treasure'] as const) {
      for (const id of marketStock(tab)) expect(all.has(id)).toBe(true)
    }
  })

  it('高境界法宝在练气期同样上架（不因境界被剔除）', () => {
    // 金丹期才能「使用」的悟道莲台，练气期照样在货架上
    expect(marketStock('treasure')).toContain('treasure_lotus')
    expect(ITEMS.treasure_lotus.minRealm).toBe('golden_core')
    expect(itemUsableAt('treasure_lotus', 'qi')).toBe(false)
    expect(itemUsableAt('treasure_lotus', 'golden_core')).toBe(true)
    expect(itemUsageHint('treasure_lotus')).toContain('金丹')
  })

  it('渡劫令：买卖不设闸门，仅使用门槛为大乘', () => {
    expect(marketStock('material')).toContain('mat_tribulation')
    expect(itemUsageRealm('mat_tribulation')).toBe('mahayana')
    expect(itemUsableAt('mat_tribulation', 'qi')).toBe(false)
    expect(itemUsableAt('mat_tribulation', 'mahayana')).toBe(true)
  })

  it('无 minRealm 的货物：无使用门槛（功法秘籍等）', () => {
    const free = MARKET_STOCK.gongfa.find((id) => itemUsageRealm(id) === null)
    expect(free).toBeDefined()
    expect(itemUsableAt(free!, 'qi')).toBe(true)
    expect(itemUsageHint(free!)).toBe('')
  })
})
