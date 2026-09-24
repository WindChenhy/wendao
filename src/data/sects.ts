import { realmIndex, realmCombatBase } from './realms'
import type { EnemyDef, RealmId } from '../types'

export type SectAlignment = 'righteous' | 'demonic'

/** 宗门职位：杂役 → 外门 → 内门 → 亲传 → 真传 → 执事 → 长老 → 大长老 → 宗主 → 太上长老 */
export type SectRank =
  | 'menial'
  | 'outer'
  | 'inner'
  | 'personal'
  | 'true'
  | 'steward'
  | 'elder'
  | 'grand_elder'
  | 'master'
  | 'supreme'

/** 进入该职位的方式；optional 为无条件自由晋升（宗主→太上长老） */
export type RankEntry = 'none' | 'contribution' | 'exam' | 'realm' | 'optional'

export interface SectRankDef {
  id: SectRank
  name: string
  desc: string
  /** 晋升进入此职位所需贡献 */
  entryCost: number
  /** 晋升方式：杂役为起点；外门只看贡献；弟子晋升需大比考核；执事及以上看贡献与修为 */
  entry: RankEntry
  /** entry === 'exam' 时的大比难度层级（1-3） */
  examTier?: 1 | 2 | 3
  /** entry === 'realm' 时的修为门槛 */
  realmReq?: { realm: RealmId; layer: number }
  /** 职级修炼速度倍率 */
  cultivateMul: number
  /** 职级委托贡献倍率 */
  taskMul: number
}

export const SECT_RANK_ORDER: SectRank[] = [
  'menial',
  'outer',
  'inner',
  'personal',
  'true',
  'steward',
  'elder',
  'grand_elder',
  'master',
  'supreme',
]

export const SECT_RANKS: Record<SectRank, SectRankDef> = {
  menial: {
    id: 'menial',
    name: '杂役弟子',
    desc: '洒扫药园、搬运灵材，以苦役换一线道缘。',
    entryCost: 0,
    entry: 'none',
    cultivateMul: 1,
    taskMul: 0.8,
  },
  outer: {
    id: 'outer',
    name: '外门弟子',
    desc: '录入外门名册，可领宗门委托、兑换丹材。',
    entryCost: 30,
    entry: 'contribution',
    cultivateMul: 1.02,
    taskMul: 1,
  },
  inner: {
    id: 'inner',
    name: '内门弟子',
    desc: '内门真修，月例倍增，藏经阁向你开放。',
    entryCost: 80,
    entry: 'exam',
    examTier: 1,
    cultivateMul: 1.05,
    taskMul: 1.2,
  },
  personal: {
    id: 'personal',
    name: '亲传弟子',
    desc: '得长老亲授，宗门气运加身。',
    entryCost: 200,
    entry: 'exam',
    examTier: 2,
    cultivateMul: 1.08,
    taskMul: 1.4,
  },
  true: {
    id: 'true',
    name: '真传弟子',
    desc: '一脉真传，可窥宗门根本大法。',
    entryCost: 400,
    entry: 'exam',
    examTier: 3,
    cultivateMul: 1.12,
    taskMul: 1.6,
  },
  steward: {
    id: 'steward',
    name: '执事',
    desc: '执掌一殿庶务，门下弟子皆听调遣。',
    entryCost: 600,
    entry: 'realm',
    realmReq: { realm: 'foundation', layer: 1 },
    cultivateMul: 1.14,
    taskMul: 1.8,
  },
  elder: {
    id: 'elder',
    name: '长老',
    desc: '开坛讲法，坐镇一方。',
    entryCost: 1000,
    entry: 'realm',
    realmReq: { realm: 'golden_core', layer: 1 },
    cultivateMul: 1.16,
    taskMul: 2,
  },
  grand_elder: {
    id: 'grand_elder',
    name: '大长老',
    desc: '一人之下，代掌门户兵符。',
    entryCost: 2000,
    entry: 'realm',
    realmReq: { realm: 'nascent_soul', layer: 1 },
    cultivateMul: 1.18,
    taskMul: 2.2,
  },
  master: {
    id: 'master',
    name: '宗主',
    desc: '执一宗之权柄，掌山门气运。',
    entryCost: 3000,
    entry: 'realm',
    realmReq: { realm: 'spirit_sea', layer: 1 },
    cultivateMul: 1.2,
    taskMul: 2.5,
  },
  supreme: {
    id: 'supreme',
    name: '太上长老',
    desc: '不问俗务，天地间自在逍遥。宗主可自行抉择是否退位隐修。',
    entryCost: 0,
    entry: 'optional',
    cultivateMul: 1.25,
    taskMul: 3,
  },
}

export function nextSectRank(rank: SectRank): SectRank | null {
  const i = SECT_RANK_ORDER.indexOf(rank)
  return i >= 0 && i < SECT_RANK_ORDER.length - 1 ? SECT_RANK_ORDER[i + 1] : null
}

export function sectRankLabel(rank: SectRank): string {
  return SECT_RANKS[rank]?.name ?? rank
}

/** 权限门槛：0 杂役 / 1 外门可兑换 / 2 内门可入藏经阁 */
export function sectRankIndex(rank: SectRank): number {
  return SECT_RANK_ORDER.indexOf(rank)
}

/**
 * 宗门大比考核对手：同门弟子，境界随玩家、层数随考核层级抬升。
 * tier 1 对外门、tier 2 对内门、tier 3 对亲传。
 */
export function sectExamOpponent(realm: RealmId, layer: number, tier: 1 | 2 | 3): EnemyDef {
  const names: Record<1 | 2 | 3, string> = {
    1: '同门俊才',
    2: '内门翘楚',
    3: '亲传首席',
  }
  const base = realmCombatBase(realm, Math.min(9, layer + tier))
  return {
    id: `sect_exam_${tier}`,
    name: names[tier],
    faction: 'righteous',
    realm,
    layer: Math.min(9, layer + tier),
    atk: Math.floor(base.atk * (0.9 + tier * 0.05)),
    def: Math.floor(base.def * (0.95 + tier * 0.05)),
    hp: Math.floor(base.hp * (0.85 + tier * 0.1)),
    loot: { exp: Math.floor(60 * (realmIndex(realm) + 1) * tier) },
    flavor: '大比台上的同门对手，招式堂堂正正。',
  }
}

export interface SectDef {
  id: string
  name: string
  alignment: SectAlignment
  /** 入门最低境界 */
  minRealm: RealmId
  minRealmLayer: number
  /** 入门所需声望 */
  minRep: number
  desc: string
  /** 宗门加成 */
  bonus: {
    cultivateMul: number
    breakthroughBonus: number
  }
  /** 贡献商店；minRank/minRealm 满足后才展示可兑换 */
  shop: {
    itemId: string
    cost: number
    minRank?: SectRank
    minRealm?: RealmId
  }[]
  /** 藏经阁 */
  library: { id: string; name: string; cost: number; desc: string; effect: 'atk' | 'def' | 'hp' | 'cultivate' }[]
}

export const SECTS: SectDef[] = [
  {
    id: 'qingyun',
    name: '青云剑宗',
    alignment: 'righteous',
    minRealm: 'qi',
    minRealmLayer: 3,
    minRep: 0,
    desc: '以剑入道，门规严整，剑冢藏经皆是上乘。',
    bonus: { cultivateMul: 1.05, breakthroughBonus: 3 },
    shop: [
      { itemId: 'pill_qi', cost: 15 },
      { itemId: 'pill_heal', cost: 10 },
      { itemId: 'pill_break', cost: 40 },
      { itemId: 'mat_foundation', cost: 80 },
    ],
    library: [
      { id: 'js_jian', name: '青云剑诀', cost: 100, desc: '攻击 +10%', effect: 'atk' },
      { id: 'js_xin', name: '澄心诀', cost: 60, desc: '修炼速度 +8%', effect: 'cultivate' },
      { id: 'js_jiantai', name: '青云剑胎', cost: 360, desc: '攻击 +20%', effect: 'atk' },
      { id: 'js_taixu', name: '青云太虚剑典', cost: 1200, desc: '攻击 +28%、受伤降低 5%', effect: 'atk' },
    ],
  },
  {
    id: 'taiyi',
    name: '太一丹宗',
    alignment: 'righteous',
    minRealm: 'qi',
    minRealmLayer: 5,
    minRep: 10,
    desc: '丹道圣地，贡献可换稀有丹材与突破灵物。',
    bonus: { cultivateMul: 1.08, breakthroughBonus: 2 },
    shop: [
      { itemId: 'pill_qi', cost: 12 },
      { itemId: 'pill_break', cost: 35 },
      { itemId: 'pill_break_adv', cost: 120 },
      { itemId: 'mat_foundation', cost: 70 },
      { itemId: 'mat_core', cost: 250 },
      {
        itemId: 'mat_tribulation',
        cost: 2800,
        minRank: 'true',
        minRealm: 'mahayana',
      },
    ],
    library: [
      { id: 'ty_dan', name: '太一丹解', cost: 80, desc: '修炼速度 +12%', effect: 'cultivate' },
      { id: 'ty_ti', name: '药体诀', cost: 90, desc: '气血 +15%', effect: 'hp' },
      { id: 'ty_danding', name: '丹鼎真火录', cost: 420, desc: '修炼 +20%、气血 +8%', effect: 'cultivate' },
      { id: 'ty_changsheng', name: '长生药王经', cost: 1100, desc: '修炼 +22%、气血 +18%', effect: 'cultivate' },
    ],
  },
  {
    id: 'haoti',
    name: '浩天体宗',
    alignment: 'righteous',
    minRealm: 'qi',
    minRealmLayer: 7,
    minRep: 20,
    desc: '肉身成圣，藏经阁多淬体秘法。',
    bonus: { cultivateMul: 1.0, breakthroughBonus: 6 },
    shop: [
      { itemId: 'pill_heal', cost: 8 },
      { itemId: 'mat_foundation', cost: 75 },
    ],
    library: [
      { id: 'ht_ti', name: '浩天淬体篇', cost: 120, desc: '防御 +15%', effect: 'def' },
      { id: 'ht_mai', name: '不灭经', cost: 200, desc: '气血 +25%', effect: 'hp' },
      { id: 'ht_shenshen', name: '神身合一法', cost: 1000, desc: '气血 +28%、防御 +18%', effect: 'hp' },
    ],
  },
  {
    id: 'xuesha',
    name: '血煞魔宫',
    alignment: 'demonic',
    minRealm: 'qi',
    minRealmLayer: 3,
    minRep: -10,
    desc: '魔道巨擘，血池煞脉，功法霸道却易遭反噬。',
    bonus: { cultivateMul: 1.12, breakthroughBonus: -2 },
    shop: [
      { itemId: 'demon_shard', cost: 10 },
      { itemId: 'mat_foundation', cost: 60 },
      { itemId: 'mat_core', cost: 220 },
    ],
    library: [
      { id: 'xs_sha', name: '血煞魔功', cost: 100, desc: '攻击 +18%', effect: 'atk' },
      { id: 'xs_sui', name: '噬魂秘录', cost: 150, desc: '修炼速度 +15%', effect: 'cultivate' },
      { id: 'xs_xuehai', name: '血海魔身', cost: 480, desc: '攻击 +12%、气血 +20%', effect: 'hp' },
      { id: 'xs_wangmo', name: '万魔朝宗', cost: 1300, desc: '攻击 +32%', effect: 'atk' },
    ],
  },
  {
    id: 'youming',
    name: '幽冥鬼宗',
    alignment: 'demonic',
    minRealm: 'foundation',
    minRealmLayer: 1,
    minRep: -30,
    desc: '御魂驱鬼，阴德有亏，进境极快。',
    bonus: { cultivateMul: 1.15, breakthroughBonus: -4 },
    shop: [
      { itemId: 'mat_core', cost: 200 },
      { itemId: 'mat_soul', cost: 800 },
      {
        itemId: 'mat_tribulation',
        cost: 2600,
        minRank: 'true',
        minRealm: 'mahayana',
      },
    ],
    library: [
      { id: 'ym_gui', name: '幽冥引魂经', cost: 180, desc: '修炼速度 +20%', effect: 'cultivate' },
      { id: 'ym_zhanshen', name: '幽冥斩神录', cost: 620, desc: '攻击 +26%、受伤降低 6%', effect: 'atk' },
      { id: 'ym_lunhui', name: '轮回鬼典', cost: 1250, desc: '修炼 +30%、受伤降低 8%', effect: 'cultivate' },
    ],
  },
]

/** 藏经阁秘法展示信息（修炼页功法栏/背包功法页共用） */
export interface SectArtInfo {
  id: string
  name: string
  /** 效果文案，如 "攻击 +10%" */
  label: string
  sectName: string
}

export function sectsFor(
  alignment: 'righteous' | 'demonic',
  realm: RealmId,
  layer: number,
  repRight: number,
  repDemonic: number,
): SectDef[] {
  return SECTS.filter((s) => {
    if (s.alignment !== alignment) return false
    if (realmIndex(realm) < realmIndex(s.minRealm)) return false
    if (realm === s.minRealm && layer < s.minRealmLayer) return false
    if (s.alignment === 'righteous') return repRight >= s.minRep
    return repDemonic >= -s.minRep || repRight <= s.minRep
  })
}
