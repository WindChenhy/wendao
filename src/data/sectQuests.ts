import type { SectRank } from './sects'
import type { RealmId } from '../types'
import { realmIndex } from './realms'
import { sectRankIndex } from './sects'
import sectQuestsDb from './db/sect_quests.json'

type QuestStepType = 'deliver' | 'explore_win' | 'report' | 'stones'

interface QuestStepDef {
  type: QuestStepType
  desc: string
  itemId?: string
  count?: number
  stones?: number
}

interface QuestChainReward {
  contribution: number
  stone?: number
  /** 藏经残页掉落概率 0～1 */
  fragmentChance?: number
  exp?: number
}

interface QuestChainDef {
  id: string
  name: string
  brief: string
  align?: 'righteous' | 'demonic' | 'any'
  minRank?: SectRank
  minRealm?: RealmId
  steps: QuestStepDef[]
  reward: QuestChainReward
}

export interface SectQuestState {
  chainId: string
  stepIndex: number
  /** 多目标步骤进度（explore_win 等） */
  progress: number
  /** 已完成环数（含当前已做完未回报） */
  completedSteps: number
}

/** 任务链表：src/data/db/sect_quests.json */
const QUEST_CHAINS: QuestChainDef[] = sectQuestsDb as QuestChainDef[]

export function questChainById(id: string): QuestChainDef | null {
  return QUEST_CHAINS.find((c) => c.id === id) ?? null
}

/** 交付类步骤的可选物品（any_* 通配） */
export function questDeliverCandidates(step: QuestStepDef): string[] {
  if (!step.itemId) return []
  if (step.itemId === 'any_mat') return ['snake_gall', 'fox_core', 'tiger_bone']
  if (step.itemId === 'any_break') return ['mat_foundation', 'mat_core', 'mat_soul', 'mat_tribulation']
  if (step.itemId === 'any_special') return ['demon_shard', 'mat_foundation', 'mat_core', 'mat_soul']
  return [step.itemId]
}

export function questStepMatchesDeliver(
  step: QuestStepDef,
  inventory: Record<string, number>,
): { ok: boolean; itemId?: string; need: number } {
  if (step.type !== 'deliver') return { ok: true, need: 0 }
  const need = step.count ?? 1
  for (const id of questDeliverCandidates(step)) {
    if ((inventory[id] ?? 0) >= need) return { ok: true, itemId: id, need }
  }
  const first = questDeliverCandidates(step)[0]
  return { ok: false, itemId: first, need }
}

export function availableQuestChains(
  rank: SectRank,
  realm: RealmId,
  alignment: 'righteous' | 'demonic',
): QuestChainDef[] {
  return QUEST_CHAINS.filter((c) => {
    if (c.align && c.align !== 'any' && c.align !== alignment) return false
    if (c.minRank && sectRankIndex(rank) < sectRankIndex(c.minRank)) return false
    if (c.minRealm && realmIndex(realm) < realmIndex(c.minRealm)) return false
    return true
  })
}

export function describeQuestReward(r: QuestChainReward): string {
  const parts = [`贡献 +${r.contribution}`]
  if (r.stone) parts.push(`灵石 +${r.stone}`)
  if (r.exp) parts.push(`修为 +${r.exp}`)
  if (r.fragmentChance) parts.push(`残页概率 ${Math.round(r.fragmentChance * 100)}%`)
  return parts.join('，')
}
