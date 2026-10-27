import { describe, expect, it } from 'vitest'
import {
  GONGFA_LIST,
  GONGFA_REALM_EXP_MUL,
  GONGFA_STAGE_LABELS,
  gongfaAdvanceCost,
  gongfaComprehendCost,
  type GongfaGrade,
} from './gongfa'
import { ITEMS, MARKET_STOCK } from './items'
import { HERB_ITEMS, SEED_LIST } from './abode'
import seedsRaw from './db/seeds.json'
import herbsRaw from './db/herbs.json'
import { CULTIVATABLE_REALMS, expNeeded, realmIndex, REALM_ORDER } from './realms'
import { MARKET_PRICE_TIER_MUL } from './priceCurve'
import type { RealmId } from '../types'

/** 功法表条目类型（GongfaDef 未在 gongfa.ts 导出，由数据表反推） */
type GongfaDef = (typeof GONGFA_LIST)[number]

/**
 * v1.7 数值平衡回归守卫。
 *
 * 两条曲线的口径都写成「分档表 + 锁值断言」，任何一边改数忘了另一边都会在这里炸出来：
 * 1. 功法修为消耗：随境界指数抬升（旧版天阶恒为 6 万，后期修为溢出）；
 * 2. 坊市售价：随品阶档位指数抬升（旧版顶价五百万，后期灵石收入亿级）。
 *
 * 共同的底线：前中期体感不变、后期不再溢出，且相邻档之间不断档（比值有上下界）。
 */

/** 该境界「最贵的一部功法」推到圆满的总修为（品阶越高越贵，取该境上限） */
function topGongfaFullCost(realm: RealmId): number {
  const list = GONGFA_LIST.filter((g) => g.minRealm === realm)
  if (list.length === 0) return 0
  return Math.max(
    ...list.map((g) =>
      GONGFA_STAGE_LABELS.slice(0, -1).reduce(
        (sum, _, stage) => sum + gongfaAdvanceCost(g, stage),
        0,
      ),
    ),
  )
}

/** 某境界在售物品的最高售价（按 minRealm 归组） */
function topItemPrice(realm: RealmId): number {
  const pool = [...Object.values(ITEMS), ...Object.values(HERB_ITEMS)].filter(
    (i) => i.minRealm === realm && i.price > 0,
  )
  return pool.length ? Math.max(...pool.map((i) => i.price)) : 0
}

describe('功法修为消耗曲线（v1.7）', () => {
  it('境界系数自元婴起严格递增，前中期恒为 1（前期体感不变）', () => {
    for (const r of ['qi', 'foundation', 'golden_core'] as RealmId[]) {
      expect(GONGFA_REALM_EXP_MUL[r], `${r} 不该被抬价`).toBe(1)
    }
    for (let i = 1; i < CULTIVATABLE_REALMS.length; i += 1) {
      const prev = GONGFA_REALM_EXP_MUL[CULTIVATABLE_REALMS[i - 1]]
      const cur = GONGFA_REALM_EXP_MUL[CULTIVATABLE_REALMS[i]]
      expect(cur, `${CULTIVATABLE_REALMS[i]} 系数低于前一境`).toBeGreaterThanOrEqual(prev)
    }
    // 元婴之后必须真的在涨，否则又回到「一口价」
    const nascent = realmIndex('nascent_soul')
    for (let i = nascent + 1; i < CULTIVATABLE_REALMS.length; i += 1) {
      const prev = GONGFA_REALM_EXP_MUL[CULTIVATABLE_REALMS[i - 1]]
      const cur = GONGFA_REALM_EXP_MUL[CULTIVATABLE_REALMS[i]]
      expect(cur, `${CULTIVATABLE_REALMS[i]} 系数未抬升`).toBeGreaterThan(prev)
    }
  })

  it('前中期锁值：练气黄阶 / 筑基玄阶 / 金丹地阶与旧版完全一致', () => {
    const pick = (grade: GongfaGrade, realm: RealmId): GongfaDef =>
      GONGFA_LIST.find((g) => g.grade === grade && g.minRealm === realm)!
    const huang = pick('黄阶', 'qi')
    expect([0, 1, 2].map((s) => gongfaAdvanceCost(huang, s))).toEqual([200, 600, 1200])
    const xuan = pick('玄阶', 'foundation')
    expect([0, 1, 2].map((s) => gongfaAdvanceCost(xuan, s))).toEqual([800, 2400, 4800])
    const di = pick('地阶', 'golden_core')
    expect([0, 1, 2].map((s) => gongfaAdvanceCost(di, s))).toEqual([3000, 9000, 18000])
  })

  it('每境「最贵功法圆满」随境界单调不减，元婴起严格递增且不断档', () => {
    const costs = CULTIVATABLE_REALMS.map((r) => ({ realm: r, cost: topGongfaFullCost(r) }))
    for (let i = 1; i < costs.length; i += 1) {
      expect(
        costs[i].cost,
        `${costs[i].realm} 的功法消耗较 ${costs[i - 1].realm} 回落`,
      ).toBeGreaterThanOrEqual(costs[i - 1].cost)
    }
    const nascent = realmIndex('nascent_soul')
    for (let i = nascent + 1; i < costs.length; i += 1) {
      const ratio = costs[i].cost / costs[i - 1].cost
      expect(ratio, `${costs[i].realm} / ${costs[i - 1].realm} = ${ratio.toFixed(2)}× 断档`).toBeGreaterThan(1.4)
      expect(ratio, `${costs[i].realm} / ${costs[i - 1].realm} = ${ratio.toFixed(2)}× 跳档过猛`).toBeLessThan(12)
    }
  })

  it('后期功法消耗落在「一次闭关百万级」量级：大乘/渡劫天阶圆满 ≥ 100 万', () => {
    const tian = (realm: RealmId): GongfaDef =>
      GONGFA_LIST.find((g) => g.grade === '天阶' && g.minRealm === realm)!
    for (const realm of ['mahayana', 'tribulation'] as RealmId[]) {
      const g = tian(realm)
      const full = [0, 1, 2].reduce((s, st) => s + gongfaAdvanceCost(g, st), 0)
      expect(full, `${realm} 天阶圆满仅 ${full}`).toBeGreaterThanOrEqual(1_000_000)
      // 也不该离谱到吃掉一整层：单部功法圆满 ≤ 该境首层修为需求
      expect(full, `${realm} 天阶圆满超过该境一层所需修为`).toBeLessThanOrEqual(
        expNeeded(realm, 1),
      )
    }
  })

  it('参悟门槛 = 入门→小成的一半，且随境界同步抬升', () => {
    for (const g of GONGFA_LIST) {
      expect(gongfaComprehendCost(g)).toBe(Math.floor(gongfaAdvanceCost(g, 0) * 0.5))
    }
    const scrolls = MARKET_STOCK.gongfa.map((id) => id)
    expect(scrolls.length).toBeGreaterThan(0)
    const lowRealm = GONGFA_LIST.find((g) => g.minRealm === 'qi')!
    const highRealm = GONGFA_LIST.find((g) => g.minRealm === 'tribulation')!
    expect(gongfaComprehendCost(highRealm)).toBeGreaterThan(gongfaComprehendCost(lowRealm))
  })
})

describe('坊市价格曲线（v1.7）', () => {
  it('档位系数严格递增，相邻档比值在 1.15~3 之间（不断档、不跳档）', () => {
    for (let i = 1; i < MARKET_PRICE_TIER_MUL.length; i += 1) {
      const ratio = MARKET_PRICE_TIER_MUL[i] / MARKET_PRICE_TIER_MUL[i - 1]
      expect(ratio, `第 ${i + 1} 档 / 第 ${i} 档 = ${ratio.toFixed(2)}×`).toBeGreaterThanOrEqual(1.15)
      expect(ratio, `第 ${i + 1} 档 / 第 ${i} 档 = ${ratio.toFixed(2)}×`).toBeLessThanOrEqual(3)
    }
  })

  it('各境顶价自元婴起严格递增，且后期进入「千万～亿」量级', () => {
    const tops = CULTIVATABLE_REALMS.map((r) => ({ realm: r, price: topItemPrice(r) }))
    const nascent = realmIndex('nascent_soul')
    for (let i = nascent + 1; i < tops.length; i += 1) {
      expect(
        tops[i].price,
        `${tops[i].realm} 顶价 ${tops[i].price} 未高于 ${tops[i - 1].realm} 的 ${tops[i - 1].price}`,
      ).toBeGreaterThan(tops[i - 1].price)
    }
    // 旧版顶价五百万；后期灵石收入是千万～亿级，顶价必须跟上
    expect(tops[tops.length - 1].price, '渡劫顶价仍停在百万级').toBeGreaterThanOrEqual(500_000_000)
    const maha = tops.find((t) => t.realm === 'mahayana')!
    expect(maha.price, '大乘顶价未上亿级门槛').toBeGreaterThanOrEqual(50_000_000)
  })

  it('突破灵材链条随目标境界单调递增（冲关材料不出现价格倒挂）', () => {
    const chain = ['mat_foundation', 'mat_core', 'mat_soul', 'mat_spirit', 'mat_void', 'mat_integration', 'mat_mahayana', 'mat_tribulation'] as const
    for (let i = 1; i < chain.length; i += 1) {
      const prev = ITEMS[chain[i - 1]]?.price ?? 0
      const cur = ITEMS[chain[i]]?.price ?? 0
      expect(cur, `${chain[i]}(${cur}) 低于 ${chain[i - 1]}(${prev})`).toBeGreaterThan(prev)
    }
  })

  it('灵植与种子同档缩放：灵田「买种—种植—卖出」的收益率不变', () => {
    const rawSeed = Object.fromEntries((seedsRaw as { id: string; seedPrice: number }[]).map((s) => [s.id, s.seedPrice]))
    const rawHerb = Object.fromEntries((herbsRaw as { id: string; price: number }[]).map((h) => [h.id, h.price]))
    for (const s of SEED_LIST) {
      const herb = HERB_ITEMS[s.yieldItemId]
      if (!herb) continue
      const raw = (rawHerb[s.yieldItemId] ?? 0) / (rawSeed[s.id] ?? 1)
      const now = herb.price / s.seedPrice
      expect(now, `${s.id} 收益率被曲线改变：${raw.toFixed(2)} → ${now.toFixed(2)}`).toBeCloseTo(raw, 1)
    }
  })

  it('同系列五纹丹与母本同档缩放：丹纹溢价倍率不被曲线放大', () => {
    for (const item of Object.values(ITEMS)) {
      if (!/_w5$/.test(item.id)) continue
      const base = ITEMS[item.id.replace(/_w5$/, '')]
      if (!base || base.price <= 0) continue
      // 旧表恒为 3.5×（丹纹 1.75 × 溢价 2），曲线不得改变这个比值
      expect(item.price / base.price).toBeCloseTo(3.5, 1)
    }
  })

  it('输出对照表（调试用：npm test -- --reporter=verbose 可见）', () => {
    const lines: string[] = ['境界        顶价          /同期秘境单次   最贵功法圆满   参悟']
    // 同期灵石收入参考（一次秘境全清的期望值，量级用；改动玩法系数时需同步复核）
    const towerIncome: Record<string, number> = {
      qi: 5.7e2,
      foundation: 6.0e3,
      golden_core: 7.5e4,
      nascent_soul: 4.8e5,
      spirit_sea: 3.5e6,
      void: 4.1e7,
      integration: 2.3e8,
      mahayana: 1.4e9,
      tribulation: 1.0e10,
    }
    for (const r of CULTIVATABLE_REALMS) {
      const price = topItemPrice(r)
      lines.push(
        [
          r.padEnd(12),
          String(price).padStart(11),
          (price / towerIncome[r]).toFixed(3).padStart(14),
          String(topGongfaFullCost(r)).padStart(14),
          String(
            Math.max(
              ...GONGFA_LIST.filter((g) => g.minRealm === r).map((g) => gongfaComprehendCost(g)),
              0,
            ),
          ).padStart(11),
        ].join(''),
      )
    }
    // eslint-disable-next-line no-console
    console.log('\n' + lines.join('\n'))
    expect(CULTIVATABLE_REALMS.length).toBe(9)
    expect(REALM_ORDER.length).toBe(10)
  })
})
