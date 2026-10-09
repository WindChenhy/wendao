import { realmIndex, realmCombatBase } from './realms'
import type { EnemyDef, RealmId } from '../types'
import sectsDb from './db/sects.json'

type SectAlignment = 'righteous' | 'demonic'

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
type RankEntry = 'none' | 'contribution' | 'exam' | 'realm' | 'optional'

interface SectRankDef {
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

/** 职级表：src/data/db/sects.json（ranks） */
export const SECT_RANKS: Record<SectRank, SectRankDef> = sectsDb.ranks as Record<SectRank, SectRankDef>

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

/** 宗门表：src/data/db/sects.json（sects） */
export const SECTS: SectDef[] = sectsDb.sects as SectDef[]

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
