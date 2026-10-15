import { describe, expect, it } from 'vitest'
import {
  CATEGORY_LABELS,
  ITEMS,
  MARKET_STOCK,
  itemCategory,
  itemTierText,
  marketStock,
} from './items'

describe('R-18 突破灵材分页语义', () => {
  it('所有 mat_* 物品归入 material，无一混入 herb', () => {
    const mats = Object.values(ITEMS).filter((i) => i.id.startsWith('mat_'))
    expect(mats.length).toBeGreaterThan(0)
    for (const m of mats) {
      expect(itemCategory(m.id), `${m.id} 应归灵材页`).toBe('material')
    }
    // 灵药页不再含任何突破材料
    expect(MARKET_STOCK.herb.some((id) => id.startsWith('mat_'))).toBe(false)
  })

  it('灵材货架存在且全是 mat_*，并在 material 分区可见', () => {
    expect(MARKET_STOCK.material.length).toBeGreaterThan(0)
    for (const id of MARKET_STOCK.material) {
      expect(id.startsWith('mat_'), `${id} 放在灵材货架却不是 mat_*`).toBe(true)
    }
    // 全部货架中能找到筑基丹（买卖不限境界）
    const all = marketStock('all')
    expect(all).toContain('mat_foundation')
    // material 分区中不含丹药/灵药/法宝
    for (const id of marketStock('material')) {
      expect(itemCategory(id)).toBe('material')
    }
  })

  it('herb 分类只保留灵药与妖材', () => {
    expect(itemCategory('herb_qi')).toBe('herb')
    expect(itemCategory('snake_gall')).toBe('herb')
    // 妖材未被错误升格为灵材
    for (const id of ['fox_core', 'tiger_bone', 'demon_shard']) {
      expect(itemCategory(id)).toBe('herb')
    }
    // 既有分类不受影响
    expect(itemCategory('pill_qi')).toBe('pill')
    expect(itemCategory('sect_fragment')).toBe('misc')
  })

  it('灵材品阶文案称「灵材」而非「灵物」，名实相符', () => {
    const txt = itemTierText(ITEMS.mat_foundation)
    expect(txt).toContain('2阶灵材')
    expect(txt).not.toContain('灵物')
    // 灵药仍称灵物
    expect(itemTierText(ITEMS.herb_qi)).toContain('灵物')
  })

  it('分类标签完备（material 有中文名）', () => {
    expect(CATEGORY_LABELS.material).toBe('灵材')
  })
})
