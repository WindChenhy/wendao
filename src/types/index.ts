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
  }
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
  plots: PlotState[]
  /** 器阁等级（0=未建） */
  forgeLevel: number
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
