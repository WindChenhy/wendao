import type { StoryBeat } from '../data/companions'
import type { WorldEvent } from '../data/events'
import type { SectQuestState } from '../data/sectQuests'
import type { SectRank } from '../data/sects'
import type { ArtifactInstance } from '../data/artifacts'
import type {
  AbodeState,
  GameTime,
  LegacyState,
  MetaState,
  PlayerState,
} from '../types'
import type { OfflineSettlement } from '../game/offline'
import type { TribulationPlanId } from '../data/tribulation'
import type { SealedItem } from '../game/seal'
import type { PetState } from '../data/pets'
import type { CharacterCreateInput } from '../types'
import type { PlayerAction } from '../game/combatEngine'

export interface OfflinePending extends OfflineSettlement {
  stones: number
  pillId: string | null
  pillName: string
}

export type GamePhase = 'menu' | 'create' | 'play'

export interface GongfaLearned {
  /** 修习阶段：0 入门 / 1 小成 / 2 大成 / 3 圆满 */
  stage: number
}

export interface GongfaState {
  /** 已参悟功法 */
  learned: Record<string, GongfaLearned>
}

export interface SectState {
  sectId: string | null
  rank: SectRank
  contribution: number
  learned: string[]
  taskDoneOn: string
  /** 宗门大比考核通过（考核型晋升必需，晋升后消耗） */
  examPassed: boolean
  /** v0.9 进行中的任务链（可中断续做） */
  quest: SectQuestState | null
  /** 宗主建设：藏经阁扩容 0～3 */
  libraryLv: number
  /** 宗主建设：坊市折扣 0～3 */
  marketLv: number
  /** 已完成任务链条数 */
  questsDone: number
  /** 已用残页参悟次数 */
  fragmentsUsed: number
  /** v1.1 宗门贡献池（公共账房） */
  pool: number
  /** v1.1 建筑等级：灵脉/丹房/剑冢 */
  buildings: Record<string, number>
}

export interface CompanionState {
  /** companionId → 好感 */
  affinity: Record<string, number>
  /** 已触发心事件索引 */
  heartsSeen: Record<string, number>
  /** 已结缘 */
  spouseId: string | null
  /** 双修冷却日 key */
  dualDoneOn: string
  /** v0.9 结缘后剧情进度 */
  postStage: Record<string, number>
  /** 已达成结局 key: `${companionId}_${he|be}` */
  endings: Record<string, 'he' | 'be'>
  /** 全局剧情 flag */
  flags: string[]
  /** 已解锁隐藏道侣 */
  hiddenUnlocked: string[]
  /** 道侣代劳灵田日 key */
  farmHelpOn: string
  /** 道侣代炼丹药日 key */
  pillHelpOn: string
  /** v1.0 道侣重伤：恢复日序（dayNumber） */
  spouseHurtUntilDay?: number
}

export interface PendingStory {
  companionId: string
  beat: StoryBeat
}

export interface SlotSnapshot {
  version: number
  time: GameTime
  player: PlayerState
  stones: number
  inventory: Record<string, number>
  sect: SectState
  treasures: string[]
  /** v0.8 炼器实例（品质/词条）；treasures 为 active 的 baseId */
  artifacts: ArtifactInstance[]
  companion: CompanionState
  gongfa: GongfaState
  towerBest: Record<string, number>
  abode: AbodeState
  legacy: LegacyState
  /** v0.7 图鉴/成就/离线元数据 */
  meta?: MetaState
  /** v1.2 本命灵兽 */
  pet?: PetState | null
  updatedAt: number
}

export interface PendingEvent {
  event: WorldEvent
  kind: 'meditate' | 'seclude' | 'explore' | 'tower'
}

export type { TribulationPlanId, SealedItem, CharacterCreateInput, PlayerAction }
