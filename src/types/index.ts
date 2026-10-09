import type { StoryBeat } from '../data/companions'
import type { WorldEvent } from '../data/events'
import type { SectQuestState } from '../data/sectQuests'
import type { SectRank } from '../data/sects'
import type { ArtifactInstance } from '../data/artifacts'
import type { OfflineSettlement } from '../game/offline'
import type { PetState } from '../data/pets'

export type Gender = 'male' | 'female'

export type ClassId =
  | 'sword'
  | 'body'
  | 'alchemy'
  | 'artifact'
  | 'talisman'
  | 'soul'
  | 'demon'

export type Faction = 'righteous' | 'demonic' | 'beast' | 'abomination'

export type RealmId =
  | 'qi'
  | 'foundation'
  | 'golden_core'
  | 'nascent_soul'
  | 'spirit_sea'
  | 'void'
  | 'integration'
  | 'mahayana'
  | 'tribulation'
  | 'ascended'

export interface ClassDef {
  id: ClassId
  name: string
  faction: 'righteous' | 'neutral' | 'demonic'
  desc: string
  /** 修炼速度倍率 */
  cultivateRate: number
  /** 突破加成（百分点） */
  breakthroughBonus: number
  /** 战斗攻击倍率 */
  atkMul: number
  /** 战斗防御倍率 */
  defMul: number
  /** 战斗气血倍率 */
  hpMul: number
  /** 特色标签 */
  tags: string[]
}

export interface RealmDef {
  id: RealmId
  name: string
  /** 该境界小层层数 */
  layers: number
  /** 每层所需修为（基准，按层号缩放） */
  expPerLayer: number
  /** 突破到下一大境界基础成功率 % */
  breakthroughBaseRate: number
  /** 该境界寿命（年） */
  lifespan: number
}

export interface EnemyDef {
  id: string
  name: string
  faction: Faction
  realm: RealmId
  layer: number
  atk: number
  def: number
  hp: number
  loot: { stone?: number; exp?: number; itemId?: string; dropRate?: number }
  flavor: string
}

export interface ItemDef {
  id: string
  name: string
  type: 'consumable' | 'material' | 'quest'
  desc: string
  price: number
  /** 使用效果 */
  effect?: {
    hp?: number
    exp?: number
    stone?: number
    energy?: number
    /** 服用后提升本次/后续突破成功率（百分点）；突破丹药在冲击壁垒时自动消耗 */
    breakthroughRate?: number
    /** 复活/回满等特殊效果标记 */
    special?: 'full_heal' | 'cleanse'
  }
  /** 丹药品阶 1～9（对应大境界） */
  pillGrade?: number
  /** 丹纹 0～5，5 纹最佳；效果 = 基础 × (1 + danMarks * 0.15) */
  danMarks?: number
  /** 灵药阶级 1～9 */
  herbTier?: number
  /** 法宝品阶 1～9 */
  treasureTier?: number
  /** 可服用/使用的起步境界 */
  minRealm?: RealmId
  /** 适用范围上限（超过后药效衰减或不可用） */
  maxRealm?: RealmId
}

export interface PlayerState {
  name: string
  gender: Gender
  classId: ClassId
  realm: RealmId
  layer: number
  exp: number
  hp: number
  maxHp: number
  /** 当前灵力/魔元 */
  energy: number
  maxEnergy: number
  /** 魔修煞气 */
  shaqi: number
  age: number
  /** 剩余寿命（年） */
  lifespanLeft: number
  /** 正道声望 */
  repRight: number
  /** 魔道声望 */
  repDemonic: number
  alive: boolean
  ascended: boolean
}

export interface GameTime {
  year: number
  month: number
  day: number
}

export type LogLevel = 'info' | 'good' | 'bad' | 'gold' | 'dim'

export interface LogEntry {
  id: number
  day: string
  text: string
  level: LogLevel
}

export interface SaveSlotMeta {
  index: number
  name: string
  realmLabel: string
  year: number
  updatedAt: number
  empty: boolean
}

export type PanelId =
  | 'cultivate'
  | 'character'
  | 'explore'
  | 'secret_realm'
  | 'inventory'
  | 'market'
  | 'abode'
  | 'sect'
  | 'companion'
  | 'settings'

export interface CharacterCreateInput {
  name: string
  gender: Gender
  classId: ClassId
}

/** 秘境爬塔进行中状态 */
export interface TowerRun {
  realmId: string
  floor: number
  /** 已进入但未结算本层 */
  inCombat: boolean
  /** 本次探索战报 */
  log: string[]
  left: boolean
}

export interface PlotState {
  seedId: string | null
  /** 种植时的绝对日序 */
  plantedDay: number
}

export interface AbodeState {
  /** 网格地块：索引 = row * cols + col */
  plots: PlotState[]
  /** 器阁等级（0=未建） */
  forgeLevel: number
  /** v1.3 聚灵阵等级（0=未建，上限 3）：修炼/离线效率每级 +5% */
  julingLevel: number
  /** 灵田列数（初始 6） */
  farmCols: number
  /** 灵田行数（初始 6） */
  farmRows: number
}

export interface LegacyState {
  /** 道痕：转生永久点数 */
  daoMarks: number
  /** 已转生次数（本档跨周目累计） */
  reincarnations: number
  /** 历史最高境界序号（含飞升） */
  bestRealmIndex: number
  /** 历代累计寿龄（转生时累加上一世 age）；本世年号仍从第 1 年起算 */
  totalYears: number
  /** 上一世结束时的年号（仅备注用，便于对照导出存档） */
  lastLifeEndYear: number
  /** v1.0 转生封印的传承物（跨周目） */
  sealed: import('../game/seal').SealedItem[]
}

/** 图鉴分页 */
export type CodexPageId = 'realm' | 'enemy' | 'gongfa' | 'item' | 'companion' | 'secret'

/** 图鉴已解锁 id 集合（进存档） */
export interface CollectionState {
  realm: string[]
  enemy: string[]
  gongfa: string[]
  item: string[]
  companion: string[]
  secret: string[]
}

/** 成就相关运行时统计 */
export interface MetaStats {
  /** 战斗获胜次数 */
  combatsWon: number
  /** 炼丹成功次数 */
  pillsCrafted: number
  /** 历史灵石峰值 */
  stonesPeak: number
  /** 离线结算次数 */
  offlineSettled: number
}

/** v0.7 图鉴 / 成就 / 离线元数据（进存档） */
export interface MetaState {
  collection: CollectionState
  /** 已解锁成就 id */
  achievements: string[]
  /** 已领取图鉴节点奖励 key，如 "realm:50" */
  codexRewardClaimed: string[]
  /** 已展示过的成就称号 */
  titles: string[]
  stats: MetaStats
  /** 最近在线时间戳（离线修炼结算锚点） */
  lastOnlineAt: number
}

/** v1.4 单条日课运行时状态 */
export interface DailyTaskState {
  id: string
  progress: number
  claimed: boolean
}

/** v1.4 日课（按游戏日惰性刷新；points 累计换周礼包） */
export interface DailyState {
  dayKey: string
  tasks: DailyTaskState[]
  points: number
}

/** v1.4 现实日签到（7 日一轮） */
export interface CheckinState {
  /** 上次签到日期 YYYY-MM-DD；空串表示从未签到 */
  lastDate: string
  /** 连续签到天数（断签重置为 1） */
  streak: number
}

// ---------------------------------------------------------------------------
// 运行时状态层（zustand store / 存档快照）
// ---------------------------------------------------------------------------

/** 游戏主流程阶段 */
export type GamePhase = 'menu' | 'create' | 'play'

/** 功法修习进度 */
export interface GongfaLearned {
  /** 修习阶段：0 入门 / 1 小成 / 2 大成 / 3 圆满 */
  stage: number
}

/** 已参悟功法集合 */
export interface GongfaState {
  /** 已参悟功法 */
  learned: Record<string, GongfaLearned>
}

/** 宗门身份与建设进度 */
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

/** 道侣关系状态 */
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

/** 结缘后待播放剧情 */
export interface PendingStory {
  companionId: string
  beat: StoryBeat
}

/** 修炼/历练触发的待处理世界事件 */
export interface PendingEvent {
  event: WorldEvent
  kind: 'meditate' | 'seclude' | 'explore' | 'tower'
}

/** 离线闭关结算弹窗（结算数据 + 展示用丹药信息） */
export interface OfflinePending extends OfflineSettlement {
  stones: number
  pillId: string | null
  pillName: string
}

/** 存档槽快照（序列化单位） */
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
  /** v1.2 捕捉软保底计数（失败 3 次后必得） */
  petCaptureFails?: number
  /** v1.4 日课 */
  daily?: DailyState
  /** v1.4 现实日签到 */
  checkin?: CheckinState
  /** v1.4 通缉档位 0–5 */
  wanted?: number
  /** v1.4 仙缘（飞升后长线资源） */
  favor?: number
  updatedAt: number
}
