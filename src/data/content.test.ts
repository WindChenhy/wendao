import { describe, expect, it } from 'vitest'
import { ITEMS, MARKET_STOCK, TREASURE_BONUS } from './items'
import { RECIPE_LIST } from './abode'
import { ARTIFACT_RECIPES } from './artifacts'
import { ENEMY_TEMPLATES } from './enemies'
import { SECRET_REALMS } from './secretRealms'
import { GONGFA_LIST, gongfaByScrollId, gongfaGradesAllowed } from './gongfa'
import { REALM_ORDER, realmIndex } from './realms'
import type { GongfaGrade } from './gongfa'
import type { Faction } from '../types'

/** 数据完备性：所有跨表引用必须落在已定义的 id 上；规则细节见 research/v13-content-expansion/REPORT.md E 节 */

const FACTIONS: Faction[] = ['righteous', 'demonic', 'beast', 'abomination']
const ENEMY_TIERS = ['minion', 'normal', 'elite', 'boss'] as const
const GONGFA_KINDS = ['心法', '攻击法诀', '防御法', '身法', '锻体法', '功法'] as const
const GRADES: GongfaGrade[] = ['黄阶', '玄阶', '地阶', '天阶', '仙阶']

describe('丹方与炼器配方引用完整性', () => {
  it('所有丹方 inputs/outputItemId 存在于 ITEMS', () => {
    for (const r of RECIPE_LIST) {
      expect(
        ITEMS[r.outputItemId],
        `丹方 ${r.id} 的产物 ${r.outputItemId} 不在 ITEMS 中`,
      ).toBeDefined()
      expect(r.inputs.length >= 1 && r.inputs.length <= 3, `丹方 ${r.id} 的 inputs 数量异常`).toBe(true)
      for (const input of r.inputs) {
        expect(
          ITEMS[input.itemId],
          `丹方 ${r.id} 的原料 ${input.itemId} 不在 ITEMS 中`,
        ).toBeDefined()
        expect(
          input.count >= 1 && input.count <= 6,
          `丹方 ${r.id} 的原料 ${input.itemId} 数量 ${input.count} 超出 1-6`,
        ).toBe(true)
      }
      expect(r.craftDays >= 1, `丹方 ${r.id} 的 craftDays 异常`).toBe(true)
    }
  })

  it('所有炼器配方 itemId/inputs 存在于 ITEMS', () => {
    for (const r of ARTIFACT_RECIPES) {
      expect(
        ITEMS[r.itemId],
        `炼器方 ${r.id} 的产物 ${r.itemId} 不在 ITEMS 中`,
      ).toBeDefined()
      for (const input of r.inputs) {
        expect(
          ITEMS[input.itemId],
          `炼器方 ${r.id} 的原料 ${input.itemId} 不在 ITEMS 中`,
        ).toBeDefined()
        expect(input.count >= 1, `炼器方 ${r.id} 的原料 ${input.itemId} 数量异常`).toBe(true)
      }
      expect(
        r.baseRate > 0 && r.baseRate <= 98,
        `炼器方 ${r.id} 的 baseRate ${r.baseRate} 超出 1-98`,
      ).toBe(true)
      expect(r.minForgeLevel >= 1 && r.minForgeLevel <= 3, `炼器方 ${r.id} 的 minForgeLevel 异常`).toBe(true)
    }
  })
})

describe('敌人模板完备性', () => {
  it('模板 id 唯一且互不为前缀', () => {
    for (let i = 0; i < ENEMY_TEMPLATES.length; i++) {
      for (let j = i + 1; j < ENEMY_TEMPLATES.length; j++) {
        const a = ENEMY_TEMPLATES[i].id
        const b = ENEMY_TEMPLATES[j].id
        const clash =
          a === b || a.startsWith(`${b}_`) || b.startsWith(`${a}_`)
        expect(clash, `敌人模板 id 前缀冲突：${a} 与 ${b}`).toBe(false)
      }
    }
  })

  it('faction/tier/power/matOffset/dropRate 取值合法', () => {
    for (const t of ENEMY_TEMPLATES) {
      expect(
        FACTIONS.includes(t.faction),
        `敌人模板 ${t.id} 的 faction ${t.faction} 非法`,
      ).toBe(true)
      expect(
        (ENEMY_TIERS as readonly string[]).includes(t.tier),
        `敌人模板 ${t.id} 的 tier ${t.tier} 非法`,
      ).toBe(true)
      expect(
        t.power >= 0.5 && t.power <= 1.7,
        `敌人模板 ${t.id} 的 power ${t.power} 超出 0.5-1.7`,
      ).toBe(true)
      expect(
        t.matOffset === 0 || t.matOffset === 1,
        `敌人模板 ${t.id} 的 matOffset ${t.matOffset} 非法`,
      ).toBe(true)
      if (t.dropRate !== undefined) {
        expect(
          t.dropRate > 0 && t.dropRate <= 1,
          `敌人模板 ${t.id} 的 dropRate ${t.dropRate} 非法`,
        ).toBe(true)
      }
      expect(t.name.length > 0, `敌人模板 ${t.id} 缺少名称`).toBe(true)
      expect(t.flavor.length > 0, `敌人模板 ${t.id} 缺少风味文案`).toBe(true)
    }
  })

  it('四大阵营均有模板覆盖（righteous/abomination 为本批补齐）', () => {
    const seen = new Set(ENEMY_TEMPLATES.map((t) => t.faction))
    for (const f of FACTIONS) {
      expect(seen.has(f), `敌人表缺少阵营 ${f} 的模板`).toBe(true)
    }
  })
})

describe('秘境完备性', () => {
  it('秘境 id 唯一且字段合法', () => {
    const ids = new Set<string>()
    for (const r of SECRET_REALMS) {
      expect(ids.has(r.id), `秘境 id 重复：${r.id}`).toBe(false)
      ids.add(r.id)
      expect(
        REALM_ORDER.includes(r.minRealm),
        `秘境 ${r.id} 的 minRealm ${r.minRealm} 非法`,
      ).toBe(true)
      expect(
        r.floors >= 1 && r.bossEvery >= 1 && r.bossEvery <= r.floors,
        `秘境 ${r.id} 的 floors/bossEvery 异常（${r.floors}/${r.bossEvery}）`,
      ).toBe(true)
      expect(r.env.rewardMul > 0, `秘境 ${r.id} 的 rewardMul 异常`).toBe(true)
      if (r.env.playerHpMul !== undefined) {
        expect(
          r.env.playerHpMul > 0 && r.env.playerHpMul <= 1,
          `秘境 ${r.id} 的 playerHpMul ${r.env.playerHpMul} 超出 (0,1]`,
        ).toBe(true)
      }
      expect(r.loot.stonePerFloor >= 0 && r.loot.expPerFloor >= 0, `秘境 ${r.id} 的每层奖励为负`).toBe(true)
      if (r.loot.bossItemId) {
        expect(
          ITEMS[r.loot.bossItemId],
          `秘境 ${r.id} 的镇守掉落 ${r.loot.bossItemId} 不在 ITEMS 中`,
        ).toBeDefined()
      }
    }
  })

  it('渡劫期与飞升后均有秘境（本批补齐）', () => {
    expect(
      SECRET_REALMS.some((r) => r.minRealm === 'tribulation'),
      '缺少渡劫期秘境',
    ).toBe(true)
    expect(
      SECRET_REALMS.some((r) => r.minRealm === 'ascended'),
      '缺少飞升后秘境',
    ).toBe(true)
  })
})

describe('功法品阶-起步境界规则', () => {
  it('全表满足品阶可见性规则（元婴以下天地玄黄/元婴以上天地玄/炼虚以上天地/大乘及以上仅天阶）', () => {
    for (const g of GONGFA_LIST) {
      expect(
        GRADES.includes(g.grade),
        `功法 ${g.id} 的品阶 ${g.grade} 非法`,
      ).toBe(true)
      expect(
        REALM_ORDER.includes(g.minRealm),
        `功法 ${g.id} 的 minRealm ${g.minRealm} 非法`,
      ).toBe(true)
      expect(
        (GONGFA_KINDS as readonly string[]).includes(g.kind),
        `功法 ${g.id} 的 kind ${g.kind} 非法`,
      ).toBe(true)
      if (g.grade === '仙阶') {
        // 仙阶传世特例：仅大乘及以上可参悟（gongfaGradeOk）
        expect(
          realmIndex(g.minRealm) >= realmIndex('mahayana'),
          `仙阶功法 ${g.id} 的起步境界 ${g.minRealm} 低于大乘`,
        ).toBe(true)
      } else {
        expect(
          gongfaGradesAllowed(g.minRealm).includes(g.grade),
          `功法 ${g.id}（${g.grade}）的起步境界 ${g.minRealm} 不允许该品阶`,
        ).toBe(true)
      }
      const e = g.effect
      const bounds: [string, number | undefined, number][] = [
        ['atk', e.atk, 0.6],
        ['def', e.def, 0.35],
        ['hp', e.hp, 0.45],
        ['cultivate', e.cultivate, 0.55],
        ['dodge', e.dodge, 0.18],
      ]
      for (const [key, val, cap] of bounds) {
        expect(
          val === undefined || (val > 0 && val <= cap),
          `功法 ${g.id} 的 effect.${key}=${val} 超出上限 ${cap}`,
        ).toBe(true)
      }
    }
  })
})

describe('坊市货架引用完整性', () => {
  it('pill/herb/treasure 货架条目均存在于 ITEMS', () => {
    for (const key of ['pill', 'herb', 'treasure'] as const) {
      for (const id of MARKET_STOCK[key]) {
        expect(ITEMS[id], `坊市 ${key} 货架的 ${id} 不在 ITEMS 中`).toBeDefined()
      }
    }
  })

  it('功法货架与 price>0 功法一一对应', () => {
    for (const id of MARKET_STOCK.gongfa) {
      expect(gongfaByScrollId(id), `坊市功法货架的 ${id} 无对应功法`).not.toBeNull()
    }
    for (const g of GONGFA_LIST) {
      if (g.price > 0) {
        expect(
          MARKET_STOCK.gongfa.includes(`scroll_${g.id}`),
          `坊市功法 ${g.id}（price=${g.price}）未上架`,
        ).toBe(true)
      }
    }
  })
})

describe('法宝与丹药字段完备性', () => {
  it('treasure_* 物品必有 treasureTier 且在 treasureBonus 有键', () => {
    for (const item of Object.values(ITEMS)) {
      if (!item.id.startsWith('treasure_')) continue
      expect(
        item.treasureTier !== undefined && item.treasureTier >= 1 && item.treasureTier <= 9,
        `法宝 ${item.id} 的 treasureTier 异常`,
      ).toBe(true)
      expect(TREASURE_BONUS[item.id], `法宝 ${item.id} 缺少 treasureBonus 条目`).toBeDefined()
    }
  })

  it('treasureBonus 键均指向法宝物品且数值合法', () => {
    for (const [id, bonus] of Object.entries(TREASURE_BONUS)) {
      expect(
        ITEMS[id]?.id.startsWith('treasure_'),
        `treasureBonus 键 ${id} 不是法宝物品`,
      ).toBe(true)
      const caps: [string, number | undefined, number][] = [
        ['atk', bonus.atk, 0.6],
        ['def', bonus.def, 0.45],
        ['hp', bonus.hp, 0.3],
        ['breakthrough', bonus.breakthrough, 12],
        ['cultivate', bonus.cultivate, 0.2],
        ['dodge', bonus.dodge, 0.05],
      ]
      for (const [key, val, cap] of caps) {
        expect(
          val === undefined || (val > 0 && val <= cap),
          `法宝 ${id} 的加成 ${key}=${val} 超出上限 ${cap}`,
        ).toBe(true)
      }
    }
  })

  it('丹药 pillGrade/danMarks、灵药 herbTier 取值合法', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.pillGrade !== undefined) {
        expect(item.id.startsWith('pill_'), `带 pillGrade 的物品 ${item.id} 前缀异常`).toBe(true)
        expect(
          item.pillGrade >= 1 && item.pillGrade <= 9,
          `丹药 ${item.id} 的 pillGrade ${item.pillGrade} 超出 1-9`,
        ).toBe(true)
        expect(
          (item.danMarks ?? 0) >= 0 && (item.danMarks ?? 0) <= 5,
          `丹药 ${item.id} 的 danMarks ${item.danMarks} 超出 0-5`,
        ).toBe(true)
      }
      if (item.herbTier !== undefined) {
        expect(
          item.herbTier >= 1 && item.herbTier <= 9,
          `灵物 ${item.id} 的 herbTier ${item.herbTier} 超出 1-9`,
        ).toBe(true)
      }
    }
  })
})
