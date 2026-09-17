import { realmIndex } from './realms'
import type { RealmId } from '../types'

export type SectAlignment = 'righteous' | 'demonic'

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
  /** 贡献商店 */
  shop: { itemId: string; cost: number }[]
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
      { itemId: 'mat_foundation', cost: 80 },
    ],
    library: [
      { id: 'js_jian', name: '青云剑诀', cost: 100, desc: '攻击 +10%', effect: 'atk' },
      { id: 'js_xin', name: '澄心诀', cost: 60, desc: '修炼速度 +8%', effect: 'cultivate' },
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
      { itemId: 'mat_foundation', cost: 70 },
      { itemId: 'mat_core', cost: 250 },
    ],
    library: [
      { id: 'ty_dan', name: '太一丹解', cost: 80, desc: '修炼速度 +12%', effect: 'cultivate' },
      { id: 'ty_ti', name: '药体诀', cost: 90, desc: '气血 +15%', effect: 'hp' },
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
    ],
    library: [
      { id: 'ym_gui', name: '幽冥引魂经', cost: 180, desc: '修炼速度 +20%', effect: 'cultivate' },
    ],
  },
]

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
