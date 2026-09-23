import type { SectRank } from './sects'
import type { RealmId } from '../types'
import { realmIndex } from './realms'
import { sectRankIndex } from './sects'

export type QuestStepType = 'deliver' | 'explore_win' | 'report' | 'stones'

export interface QuestStepDef {
  type: QuestStepType
  desc: string
  itemId?: string
  count?: number
  stones?: number
}

export interface QuestChainReward {
  contribution: number
  stone?: number
  /** 藏经残页掉落概率 0～1 */
  fragmentChance?: number
  exp?: number
}

export interface QuestChainDef {
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

const QUEST_CHAINS: QuestChainDef[] = [
  {
    id: 'chain_supply',
    name: '补给线',
    brief: '药堂缺料，外山据点人手紧。走一趟，宗门记你一功。',
    align: 'any',
    minRank: 'outer',
    steps: [
      { type: 'deliver', desc: '交出聚气丹 ×2', itemId: 'pill_qi', count: 2 },
      { type: 'explore_win', desc: '历练获胜 2 次', count: 2 },
      { type: 'report', desc: '回山交令（耗 1 日）' },
    ],
    reward: { contribution: 55, stone: 40, fragmentChance: 0.12, exp: 80 },
  },
  {
    id: 'chain_patrol',
    name: '巡山除妖',
    brief: '山道多妖踪，执事点名让你带队清一清。',
    align: 'any',
    minRank: 'outer',
    minRealm: 'qi',
    steps: [
      { type: 'explore_win', desc: '历练获胜 3 次', count: 3 },
      { type: 'deliver', desc: '交出妖材 ×1（蛇胆/狐核/虎骨）', itemId: 'any_mat', count: 1 },
      { type: 'report', desc: '缴令归档（耗 1 日）' },
    ],
    reward: { contribution: 70, stone: 60, fragmentChance: 0.15, exp: 120 },
  },
  {
    id: 'chain_heirloom',
    name: '残页寻踪',
    brief: '藏经阁有缺页线索流出，长老命你暗中寻访。',
    align: 'any',
    minRank: 'inner',
    minRealm: 'foundation',
    steps: [
      { type: 'deliver', desc: '交出突破材 ×1', itemId: 'any_break', count: 1 },
      { type: 'explore_win', desc: '历练获胜 2 次', count: 2 },
      { type: 'stones', desc: '打点消息费 300 灵石', stones: 300 },
      { type: 'report', desc: '密报长老（耗 1 日）' },
    ],
    reward: { contribution: 110, stone: 80, fragmentChance: 0.35, exp: 200 },
  },
  {
    id: 'chain_defend',
    name: '守山备汛',
    brief: '魔患未平，宗门加固外围据点。此行凶险，却也是扬名之机。',
    align: 'any',
    minRank: 'steward',
    minRealm: 'golden_core',
    steps: [
      { type: 'deliver', desc: '交出突破材 ×1', itemId: 'any_break', count: 1 },
      { type: 'explore_win', desc: '历练/秘境获胜 3 次', count: 3 },
      { type: 'stones', desc: '加固阵基 500 灵石', stones: 500 },
      { type: 'report', desc: '复命守山（耗 1 日）' },
    ],
    reward: { contribution: 180, stone: 150, fragmentChance: 0.28, exp: 350 },
  },
  {
    id: 'chain_decree',
    name: '宗门密令',
    brief: '宗主手谕：一桩陈年旧案，交你全权处置。慎之，重之。',
    align: 'any',
    minRank: 'elder',
    minRealm: 'nascent_soul',
    steps: [
      { type: 'stones', desc: '拨付行动经费 800 灵石', stones: 800 },
      { type: 'explore_win', desc: '历练/秘境获胜 4 次', count: 4 },
      { type: 'deliver', desc: '交出煞气结晶/突破材 ×1', itemId: 'any_special', count: 1 },
      { type: 'report', desc: '密档封存（耗 1 日）' },
    ],
    reward: { contribution: 280, stone: 200, fragmentChance: 0.45, exp: 500 },
  },
]

export const SECT_QUEST_CHAINS: QuestChainDef[] = QUEST_CHAINS

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
