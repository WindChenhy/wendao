import type { ItemDef, RealmId } from '../types'
import { REALMS, REALM_ORDER } from './realms'
import { HERB_ITEMS } from './abode'
import { GONGFA_LIST, gongfaByScrollId, gongfaScrollId, isMarketGongfa } from './gongfa'

export const ITEMS: Record<string, ItemDef> = {
  ...HERB_ITEMS,
  pill_qi: {
    id: 'pill_qi',
    name: '聚气丹',
    type: 'consumable',
    desc: '服用后获得修为（随境界提升）。',
    price: 50,
    effect: { exp: 80 },
  },
  pill_heal: {
    id: 'pill_heal',
    name: '回春散',
    type: 'consumable',
    desc: '恢复气血。',
    price: 30,
    effect: { hp: 80 },
  },
  pill_great: {
    id: 'pill_great',
    name: '凝元丹',
    type: 'consumable',
    desc: '灵植炼成的上品丹药，服之修为大涨。',
    price: 200,
    effect: { exp: 280 },
  },
  snake_gall: {
    id: 'snake_gall',
    name: '碧鳞蛇胆',
    type: 'material',
    desc: '炼丹材料，可直接服用。',
    price: 25,
    effect: { exp: 40 },
  },
  fox_core: {
    id: 'fox_core',
    name: '赤目狐核',
    type: 'material',
    desc: '妖核，蕴含幻力。',
    price: 55,
    effect: { exp: 90 },
  },
  demon_shard: {
    id: 'demon_shard',
    name: '煞气结晶',
    type: 'material',
    desc: '魔道之物，可出售或供魔修炼化。',
    price: 40,
  },
  tiger_bone: {
    id: 'tiger_bone',
    name: '虎王骨',
    type: 'material',
    desc: '炼器上材。',
    price: 90,
  },

  // —— 突破材料（大境界所需）——
  mat_foundation: {
    id: 'mat_foundation',
    name: '筑基丹',
    type: 'material',
    desc: '冲击筑基大境界必备。历练妖兽、秘境机缘可得。',
    price: 300,
  },
  mat_core: {
    id: 'mat_core',
    name: '金丹玉液',
    type: 'material',
    desc: '凝丹关键灵液，需在秘境或高阶妖兽处寻得。',
    price: 1200,
  },
  mat_soul: {
    id: 'mat_soul',
    name: '元婴果',
    type: 'material',
    desc: '温养元婴的天地灵果，极为罕见。',
    price: 5000,
  },
  mat_spirit: {
    id: 'mat_spirit',
    name: '化神莲',
    type: 'material',
    desc: '化神悟道之莲，多生于上古秘境。',
    price: 20000,
  },
  mat_void: {
    id: 'mat_void',
    name: '虚空晶',
    type: 'material',
    desc: '蕴含空间法则的晶体。',
    price: 80000,
  },
  mat_integration: {
    id: 'mat_integration',
    name: '合体石',
    type: 'material',
    desc: '调和阴阳二气的神石。',
    price: 300000,
  },
  mat_mahayana: {
    id: 'mat_mahayana',
    name: '大乘道种',
    type: 'material',
    desc: '种下道果，方证大乘。',
    price: 1200000,
  },
  mat_tribulation: {
    id: 'mat_tribulation',
    name: '渡劫令',
    type: 'material',
    desc: '引动天劫的令牌，亦可增强渡劫把握。',
    price: 5000000,
  },

  // —— 法宝/装备（奇遇 + 坊市重金可购）——
  treasure_sword: {
    id: 'treasure_sword',
    name: '青冥剑胚',
    type: 'material',
    desc: '出世法宝，认主后剑意加持。',
    price: 5000,
  },
  treasure_mirror: {
    id: 'treasure_mirror',
    name: '护心宝镜',
    type: 'material',
    desc: '出世法宝，认主后护体生光。',
    price: 5000,
  },
  treasure_pagoda: {
    id: 'treasure_pagoda',
    name: '镇魂塔',
    type: 'material',
    desc: '出世法宝，认主后塔影护身。',
    price: 8000,
  },

  // —— 功法秘籍（坊市购入，参悟后进入修炼页功法栏）——
  // —— 功法秘籍（仅坊市在售的功法；宗门秘法走藏经阁贡献参悟，不生成秘籍物品）——
  ...Object.fromEntries(
    GONGFA_LIST.filter(isMarketGongfa).map((g) => [
      gongfaScrollId(g.id),
      {
        id: gongfaScrollId(g.id),
        name: `${g.name}·秘籍`,
        type: 'quest',
        desc: `${g.grade}功法。${g.desc}`,
        price: g.price,
      } satisfies ItemDef,
    ]),
  ),
}

/** 背包/坊市分类 */
export type ItemCategory = 'herb' | 'gongfa' | 'treasure' | 'pill' | 'misc'

export function itemCategory(id: string): ItemCategory {
  if (gongfaByScrollId(id)) return 'gongfa'
  if (id.startsWith('treasure_')) return 'treasure'
  if (id.startsWith('pill_')) return 'pill'
  return 'herb'
}

/** 分类显示名 */
export const CATEGORY_LABELS: Record<ItemCategory | 'all', string> = {
  all: '全部',
  herb: '灵药',
  gongfa: '功法',
  treasure: '法宝/装备',
  pill: '丹药',
  misc: '其他',
}

/** 法宝属性加成（store 内 treasureBonus 以此为数据源，勿两处改数） */
export const TREASURE_BONUS: Record<string, { atk?: number; def?: number; hp?: number }> = {
  treasure_sword: { atk: 0.25 },
  treasure_mirror: { def: 0.25 },
  treasure_pagoda: { hp: 0.3 },
}

/** 法宝加成文案，如 "攻击 +25%" */
export function treasureEffectText(id: string): string {
  const b = TREASURE_BONUS[id]
  if (!b) return ''
  const parts: string[] = []
  if (b.atk) parts.push(`攻击 +${Math.round(b.atk * 100)}%`)
  if (b.def) parts.push(`防御 +${Math.round(b.def * 100)}%`)
  if (b.hp) parts.push(`气血 +${Math.round(b.hp * 100)}%`)
  return parts.join('、')
}

/** 大境界突破材料表 */
export const BREAKTHROUGH_MATERIALS: Partial<Record<RealmId, string>> = {
  foundation: 'mat_foundation',
  golden_core: 'mat_core',
  nascent_soul: 'mat_soul',
  spirit_sea: 'mat_spirit',
  void: 'mat_void',
  integration: 'mat_integration',
  mahayana: 'mat_mahayana',
  tribulation: 'mat_tribulation',
}

/** 大境界满层时所需材料 */
export function requiredMaterial(realm: RealmId, layer: number): string | null {
  const maxLayer = REALMS[realm]?.layers ?? 9
  if (layer < maxLayer) return null
  return BREAKTHROUGH_MATERIALS[realm] ?? null
}

export function materialName(id: string): string {
  return ITEMS[id]?.name ?? id
}

/** 聚气丹收益随境界 */
export function pillExp(realm: RealmId): number {
  const ri = Math.max(0, REALM_ORDER.indexOf(realm))
  return Math.floor(60 * Math.pow(1.55, ri))
}

/** 坊市货架（按分类）；功法只上架坊市秘籍，宗门秘法仅藏经阁产出 */
export const MARKET_STOCK: Record<'herb' | 'gongfa' | 'treasure' | 'pill', string[]> = {
  pill: ['pill_qi', 'pill_heal', 'pill_great'],
  herb: ['herb_qi', 'herb_moon', 'herb_blood', 'mat_foundation', 'mat_core'],
  gongfa: GONGFA_LIST.filter(isMarketGongfa).map((g) => gongfaScrollId(g.id)),
  treasure: ['treasure_sword', 'treasure_mirror', 'treasure_pagoda'],
}
