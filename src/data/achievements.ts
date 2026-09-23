import { realmIndex } from './realms'
import { SECT_RANK_ORDER, type SectRank } from './sects'
import type { CollectionState, LegacyState, MetaStats } from '../types'
import achievementsJson from './db/achievements.json'

export type AchievementCategory = 'milestone' | 'collect' | 'challenge' | 'story' | 'cycle'

export interface AchievementReward {
  stones?: number
  daoMarks?: number
  title?: string
}

export interface AchievementDef {
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

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestone: '里程碑',
  collect: '收集',
  challenge: '挑战',
  story: '叙事',
  cycle: '周目',
}

export interface AchievementProgressInput {
  player: {
    realm: string
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

  const ri = input.player
    ? input.player.ascended || input.player.realm === 'ascended'
      ? realmIndex('ascended')
      : Math.max(input.legacy.bestRealmIndex, realmIndex(input.player.realm as never))
    : input.legacy.bestRealmIndex
  if (ri >= realmIndex('foundation')) push('realm_foundation')
  if (ri >= realmIndex('golden_core')) push('realm_core')
  if (ri >= realmIndex('nascent_soul')) push('realm_soul')
  if (ri >= realmIndex('spirit_sea')) push('realm_spirit')
  if (ri >= realmIndex('void')) push('realm_void')
  if (input.player?.ascended || input.player?.realm === 'ascended' || ri >= realmIndex('ascended'))
    push('realm_ascend')

  if (input.collection.enemy.length >= 5) push('enemy_5')
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
  const parts: string[] = []
  if (r.stones) parts.push(`灵石 +${r.stones}`)
  if (r.daoMarks) parts.push(`道痕 +${r.daoMarks}`)
  if (r.title) parts.push(`称号「${r.title}」`)
  return parts.join(' · ') || '无'
}
