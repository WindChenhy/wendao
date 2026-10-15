import { ASCENSION_REALM, realmIndex } from './realms'
import { SECT_RANK_ORDER, type SectRank } from './sects'
import { SECRET_REALMS } from './secretRealms'
import type { CollectionState, LegacyState, MetaStats, RealmId } from '../types'
import { describeRewardParts } from '../game/reward'
import achievementsJson from './db/achievements.json'

/** 太虚仙阙总层数（唯一来源：秘境表），成就阈值跟随它变化 */
export const TAIXU_PALACE_FLOORS = SECRET_REALMS.find((r) => r.id === 'taixu_palace')?.floors ?? 99

export type AchievementCategory = 'milestone' | 'collect' | 'challenge' | 'story' | 'cycle'

interface AchievementReward {
  stones?: number
  daoMarks?: number
  title?: string
}

interface AchievementDef {
  id: string
  name: string
  desc: string
  category: AchievementCategory
  reward: AchievementReward
  hidden?: boolean
}

export const ACHIEVEMENTS: AchievementDef[] = achievementsJson.achievements as AchievementDef[]

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
)

/**
 * 成就道痕单世软上限（R-12）。
 * 道痕的主要来源应为转生结算（reincarnateGain），成就只在渡劫/飞升这类叙事节点给少量道痕，
 * 全部成就的道痕总和不得超过此值；溢出部分折算当世灵石。
 */
export const ACHIEVEMENT_DAO_CAP = 20
/** 每点溢出道痕折算的灵石数 */
export const ACHIEVEMENT_DAO_OVERFLOW_STONES = 100

/** 已领取成就合计发放的道痕 */
export function achievementDaoMarksOf(claimedIds: readonly string[]): number {
  return claimedIds.reduce((sum, id) => sum + (ACHIEVEMENT_MAP[id]?.reward.daoMarks ?? 0), 0)
}

/** 新成就发奖时按单世软上限切分：额度内发道痕，溢出折算灵石 */
export function grantAchievementDaoMarks(
  claimedIds: readonly string[],
  grantDaoMarks: number,
): { daoMarks: number; stones: number } {
  const used = achievementDaoMarksOf(claimedIds)
  const allowed = Math.max(0, ACHIEVEMENT_DAO_CAP - used)
  const daoMarks = Math.max(0, Math.min(allowed, grantDaoMarks))
  const overflow = Math.max(0, grantDaoMarks - daoMarks)
  return { daoMarks, stones: overflow * ACHIEVEMENT_DAO_OVERFLOW_STONES }
}

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestone: '里程碑',
  collect: '收集',
  challenge: '挑战',
  story: '叙事',
  cycle: '周目',
}

export interface AchievementProgressInput {
  player: {
    /** 大境界 id（RealmId，勿放宽为 string：否则 realmIndex 需靠强制转型绕过检查） */
    realm: RealmId
    layer: number
    ascended: boolean
    alive: boolean
  } | null
  legacy: LegacyState
  stones: number
  gongfaCount: number
  treasureCount: number
  companion: {
    spouseId: string | null
    heartsSeen: Record<string, number>
    affinity: Record<string, number>
    endings?: Record<string, 'he' | 'be'>
    hiddenUnlocked?: string[]
  }
  sect: {
    rank: string
    sectId: string | null
    questsDone?: number
    libraryLv?: number
    marketLv?: number
    fragmentsUsed?: number
  }
  towerBest: Record<string, number>
  collection: CollectionState
  stats: MetaStats
  /** v1.4 本世累计仙缘（飞升后长线） */
  favor?: number
  /** v1.4 已启用的 DLC id（DLC 专属成就仅在对应包启用时判定） */
  enabledDlc?: string[]
  /** v1.4 通缉档位 0–5 */
  wanted?: number
  /** v1.4 灵兽概况（无灵兽为 null） */
  pet?: { level: number; broken: boolean; bond: number } | null
  /** v1.5 已立道途数（含主修）；0 = 尚未择道 */
  pathCount?: number
}

/** DLC 包 id → 专属成就 id 列表（设置页展示进度用；未启用的包成就隐藏） */
export const DLC_ACHIEVEMENT_PACK: Record<string, string[]> = {
  demonic_war: ['dlc_war_kill10', 'dlc_war_notorious'],
  beast_taming: ['dlc_pet_lv10', 'dlc_pet_bond100'],
  immortal_relic: ['dlc_relic_favor50', 'dlc_relic_taixu30'],
}

function hasHeartEvent(heartsSeen: Record<string, number>): boolean {
  return Object.values(heartsSeen).some((n) => n > 0)
}

/** 按当前进度判定应解锁的成就 id 列表（含已解锁，调用方自行过滤） */
export function evaluateAchievementIds(input: AchievementProgressInput): string[] {
  const out: string[] = []
  const push = (id: string) => {
    if (ACHIEVEMENT_MAP[id]) out.push(id)
  }

  push('first_steps')
  if (input.stats.offlineSettled > 0) push('offline_return')
  if (input.stats.stonesPeak >= 10000 || input.stones >= 10000) push('rich')

  const asc = Boolean(
    input.player && (input.player.ascended || input.player.realm === ASCENSION_REALM),
  )
  const ri = input.player
    ? asc
      ? realmIndex(ASCENSION_REALM)
      : Math.max(input.legacy.bestRealmIndex, realmIndex(input.player.realm))
    : input.legacy.bestRealmIndex
  if (ri >= realmIndex('foundation')) push('realm_foundation')
  if (ri >= realmIndex('golden_core')) push('realm_core')
  if (ri >= realmIndex('nascent_soul')) push('realm_soul')
  if (ri >= realmIndex('spirit_sea')) push('realm_spirit')
  if (ri >= realmIndex('void')) push('realm_void')
  if (ri >= realmIndex('integration')) push('realm_integration')
  if (ri >= realmIndex('mahayana')) push('realm_mahayana')
  if (ri >= realmIndex('tribulation')) push('realm_tribulation')
  if (asc || ri >= realmIndex(ASCENSION_REALM)) push('realm_ascend')

  if (input.collection.enemy.length >= 5) push('enemy_5')
  // v1.5 道途：立道 / 兼修 / 六道同修（1 主修 + 兼修位上限 5）
  const pathCount = input.pathCount ?? 0
  if (pathCount >= 1) push('path_first')
  if (pathCount >= 3) push('path_dual')
  if (pathCount >= 6) push('path_all')
  if (input.collection.enemy.length >= 10) push('enemy_10')
  if (input.gongfaCount >= 3) push('gongfa_3')
  if (input.gongfaCount >= 10) push('gongfa_10')
  if (input.treasureCount >= 3) push('treasure_3')
  if (input.treasureCount >= 5) push('treasure_5')
  if (input.collection.realm.length >= 5) push('codex_realms_5')
  if (input.stats.pillsCrafted >= 5) push('alchemist')

  const floors = Object.values(input.towerBest)
  if (floors.some((f) => f >= 30)) push('tower_30')
  if ((input.towerBest.qingyun ?? 0) >= 30) push('clear_qingyun')
  if ((input.towerBest.ice_cave ?? 0) >= 40) push('clear_ice')
  // v1.4 飞升终局：仙缘积累与太虚仙阙贯通
  if ((input.favor ?? 0) >= 100) push('favor_100')
  // 以秘境表实际层数为准（层数调整后成就自动跟随，避免两处魔数失配）
  if ((input.towerBest.taixu_palace ?? 0) >= TAIXU_PALACE_FLOORS) push('taixu_clear')

  // v1.4 DLC 专属成就：仅在对应包启用时判定/展示
  const dlcOn = (id: string) => (input.enabledDlc ?? []).includes(id)
  if (dlcOn('demonic_war')) {
    if (input.stats.combatsWon >= 10) push('dlc_war_kill10')
    if ((input.wanted ?? 0) >= 5) push('dlc_war_notorious')
  }
  if (dlcOn('beast_taming') && input.pet) {
    if (input.pet.level >= 10) push('dlc_pet_lv10')
    if (input.pet.bond >= 100) push('dlc_pet_bond100')
  }
  if (dlcOn('immortal_relic')) {
    if ((input.favor ?? 0) >= 50) push('dlc_relic_favor50')
    if ((input.towerBest.taixu_palace ?? 0) >= 30) push('dlc_relic_taixu30')
  }

  if (hasHeartEvent(input.companion.heartsSeen)) push('heart')
  if (input.companion.spouseId) push('marry')

  const endings = Object.values(input.companion.endings ?? {})
  if (endings.includes('he')) push('spouse_story_he')
  if (endings.includes('be')) push('spouse_story_be')
  if ((input.companion.hiddenUnlocked ?? []).length > 0) push('hidden_companion')

  const questsDone = input.sect.questsDone ?? 0
  if (questsDone >= 1) push('quest_chain_1')
  if (questsDone >= 5) push('quest_chain_5')
  if ((input.sect.fragmentsUsed ?? 0) >= 1) push('sect_fragment_learn')
  if ((input.sect.libraryLv ?? 0) >= 1 || (input.sect.marketLv ?? 0) >= 1) push('sect_build')

  const rankIdx = SECT_RANK_ORDER.indexOf(input.sect.rank as SectRank)
  if (rankIdx >= SECT_RANK_ORDER.indexOf('elder')) push('sect_elder')
  if (rankIdx >= SECT_RANK_ORDER.indexOf('master')) push('sect_master')

  if (input.legacy.reincarnations >= 1) push('reincarnate_1')
  if (input.legacy.reincarnations >= 3) push('reincarnate_3')

  return out
}

export function describeReward(r: AchievementReward): string {
  return describeRewardParts(r, '无')
}
