import { describe, expect, it } from 'vitest'
import {
  ITEMS,
  MARKET_STOCK,
  itemCategory,
  itemUsageHint,
  itemUsageRealm,
  itemUsableAt,
  marketStock,
  marketStockFor,
  marketTierOf,
} from './items'
import { REALM_ORDER } from './realms'
import { gongfaByScrollId } from './gongfa'

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

/**
 * 移动端「突破大境界后坊市装备法宝 / 功法页空白」的回归防线。
 *
 * 货架派生 `marketStockFor(realm, tab)` 是**集合内的排序置换**，不是过滤器：
 * 境界只影响顺序，任何境界下集合都等于 marketStock(tab)，因此不可能被清空。
 */
describe('突破大境界后货架按新境界层级刷新（且永不为空）', () => {
  const TABS = ['pill', 'herb', 'material', 'gongfa', 'treasure'] as const

  it('每个大境界下每个分区都非空，且条目集合与 marketStock 完全一致', () => {
    for (const realm of REALM_ORDER) {
      for (const tab of TABS) {
        const entries = marketStockFor(realm, tab)
        expect(entries.length, `${realm} 的 ${tab} 分区不应为空`).toBeGreaterThan(0)
        // 排序不增删：与静态货架的集合相等（顺序可不同）
        expect(
          new Set(entries.map((e) => e.id)),
          `${realm} 的 ${tab} 分区条目集合被改动了`,
        ).toEqual(new Set(marketStock(tab)))
        expect(entries.length, `${realm} 的 ${tab} 分区条目数被改动了`).toBe(
          marketStock(tab).length,
        )
      }
    }
  })

  it('装备法宝与功法两区：任何境界下都不缺货', () => {
    for (const realm of REALM_ORDER) {
      expect(marketStockFor(realm, 'treasure').length).toBe(marketStock('treasure').length)
      expect(marketStockFor(realm, 'gongfa').length).toBe(marketStock('gongfa').length)
    }
  })

  it('境界一变即换序：当前境界用得上的货物置顶', () => {
    // 练气期：金丹法宝「悟道莲台」属超前货，应排在可用法宝之后
    const qi = marketStockFor('qi', 'treasure')
    expect(qi[0].tier, '练气期首位应是当期可用法宝').toBe('fit')
    expect(itemUsableAt(qi[0].id, 'qi')).toBe(true)
    expect(marketTierOf('treasure_lotus', 'qi')).toBe('above')
    // 金丹期：同一件法宝转为「适配」，排序随之提前
    const gc = marketStockFor('golden_core', 'treasure')
    expect(marketTierOf('treasure_lotus', 'golden_core')).toBe('fit')
    const idxQi = qi.findIndex((e) => e.id === 'treasure_lotus')
    const idxGc = gc.findIndex((e) => e.id === 'treasure_lotus')
    expect(idxGc, '突破后该法宝应前移').toBeLessThan(idxQi)
    expect(gc[0].tier).toBe('fit')
  })

  it('功法分区：起步境界未到记超前、品阶被淘汰记过时', () => {
    // 取一件有明确起步境界要求的秘籍
    const scroll = marketStock('gongfa').find((id) => {
      const g = gongfaByScrollId(id)!
      return g.minRealm !== 'qi'
    })
    expect(scroll).toBeDefined()
    const g = gongfaByScrollId(scroll!)!
    expect(marketTierOf(scroll!, 'qi')).toBe('above')
    expect(marketTierOf(scroll!, g.minRealm)).toBe('fit')
  })

  it('同档位内保持货架原始顺序（排序稳定，不抖）', () => {
    const base = marketStock('gongfa')
    for (const realm of REALM_ORDER) {
      const fit = marketStockFor(realm, 'gongfa')
        .filter((e) => e.tier === 'fit')
        .map((e) => e.id)
      expect(fit).toEqual(base.filter((id) => fit.includes(id)))
    }
  })
})
