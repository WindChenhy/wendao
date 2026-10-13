import { describe, expect, it } from 'vitest'
import {
  ITEMS,
  MARKET_CLUE_LOOKAHEAD,
  MARKET_STOCK,
  marketEntryStatus,
  marketGateRealm,
  visibleStock,
} from './items'
import { realmIndex } from './realms'

describe('R-14 坊市分级上架（visibleStock 纯函数）', () => {
  it('无境界限制的货物在任何境界都可成交', () => {
    // 坊市流通的功法秘籍不带物品 minRealm（品阶参悟门槛另由 gongfaGradeOk 管）
    const free = MARKET_STOCK.gongfa.find((id) => marketGateRealm(id) === null)
    expect(free).toBeDefined()
    expect(marketEntryStatus(free!, 'qi')).toEqual({ ok: true })
    expect(marketEntryStatus(free!, 'tribulation')).toEqual({ ok: true })
  })

  it('超前 1–2 境的货物显示为线索（locked），更远的货物不出现', () => {
    const entries = visibleStock('qi', 'pill')
    for (const e of entries) {
      if (!e.status.ok) {
        const gap = realmIndex(e.status.minRealm) - realmIndex('qi')
        expect(gap).toBeGreaterThanOrEqual(1)
        expect(gap).toBeLessThanOrEqual(MARKET_CLUE_LOOKAHEAD)
      }
    }
    // 练气货架中确有筑基/金丹的线索货
    const clues = entries.filter((e) => !e.status.ok)
    expect(clues.some((e) => e.status.ok === false && e.status.minRealm === 'foundation')).toBe(true)
    // 元婴及以上的丹药在练气期彻底不现（不剧透）
    expect(
      entries.some((e) => !e.status.ok && realmIndex(e.status.minRealm) >= realmIndex('nascent_soul')),
    ).toBe(false)
  })

  it('境界达到后线索货转为可成交', () => {
    const entries = visibleStock('golden_core', 'pill')
    const gcItem = MARKET_STOCK.pill.find((id) => ITEMS[id]?.minRealm === 'golden_core')
    expect(gcItem).toBeDefined()
    const hit = entries.find((e) => e.id === gcItem)
    expect(hit?.status).toEqual({ ok: true })
  })

  it('渡劫令：练气/化神期不现，炼虚期线索，大乘期可成交', () => {
    expect(visibleStock('qi', 'all').some((e) => e.id === 'mat_tribulation')).toBe(false)
    expect(visibleStock('spirit_sea', 'all').some((e) => e.id === 'mat_tribulation')).toBe(false)
    const clue = visibleStock('void', 'all').find((e) => e.id === 'mat_tribulation')
    expect(clue?.status).toEqual({ ok: false, minRealm: 'mahayana' })
    const open = visibleStock('mahayana', 'all').find((e) => e.id === 'mat_tribulation')
    expect(open?.status).toEqual({ ok: true })
  })

  it('分区过滤生效（法宝分区不含丹药）', () => {
    for (const e of visibleStock('qi', 'treasure')) {
      expect(e.id.startsWith('treasure_')).toBe(true)
    }
  })
})
