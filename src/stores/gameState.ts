import type { CombatEngineState, PlayerAction } from '../game/combatEngine'
import type { ArtifactInstance } from '../data/artifacts'
import type { PetJob, PetState } from '../data/pets'
import type { SectBuildingId } from '../data/sectBuildings'
import type { TribulationPlanId } from '../data/tribulation'
import type { SealedItem } from '../game/seal'
import type {
  AbodeState,
  CheckinState,
  CharacterCreateInput,
  CompanionState,
  DailyState,
  EnemyDef,
  GamePhase,
  GameTime,
  GongfaState,
  LegacyState,
  MetaState,
  OfflinePending,
  PanelId,
  PendingEvent,
  PendingStory,
  PlayerState,
  SectState,
  TowerRun,
} from '../types'

export interface GameState {
  phase: GamePhase
  time: GameTime
  player: PlayerState | null
  stones: number
  inventory: Record<string, number>
  sect: SectState
  treasures: string[]
  artifacts: ArtifactInstance[]
  companion: CompanionState
  /** 已参悟功法 */
  gongfa: GongfaState
  /** 各秘境最高通关层 */
  towerBest: Record<string, number>
  tower: TowerRun | null
  abode: AbodeState
  legacy: LegacyState
  /** v0.7 图鉴/成就/离线元数据 */
  meta: MetaState
  /** 待确认的离线闭关结算 */
  offlinePending: OfflinePending | null
  pet: PetState | null
  /** v1.2 捕捉软保底：连续失败次数（失败 PET_CAPTURE_PITY 次后必得） */
  petCaptureFails: number
  /** v1.4 日课（按游戏日惰性刷新） */
  daily: DailyState
  /** v1.4 现实日签到 */
  checkin: CheckinState
  /** v1.4 通缉档位 0–5（魔修专属；击杀正道/魔道事件升档） */
  wanted: number
  /** v1.4 仙缘（飞升后长线资源；转生按 10:1 折道痕，上限 +30） */
  favor: number
  activePanel: PanelId
  exploring: boolean
  lastCombat: { enemy: EnemyDef; win: boolean; log: string[] } | null
  pendingEvent: PendingEvent | null
  /** v0.9 结缘后剧情待确认 */
  pendingStory: PendingStory | null
  /** 进行中的回合制战斗（v0.6 技能战） */
  activeCombat: (CombatEngineState & { pendingEventAction?: string }) | null
  autoCombat: boolean
  /** 历练跳过交互战斗，直接自动结算 */
  skipExploreCombat: boolean
  /** v1.3 新战斗默认托管自动出招（SPRINT_A §5.1 设置项） */
  autoCombatDefault: boolean

  setPanel: (p: PanelId) => void
  setSkipExploreCombat: (v: boolean) => void
  setAutoCombatDefault: (v: boolean) => void
  startCreate: () => void
  createCharacter: (input: CharacterCreateInput) => void
  backToMenu: () => void
  /** 刷新在线锚点（页面隐藏/定时心跳） */
  touchOnline: () => void
  /** 回到前台或必要时重算离线闭关 */
  recheckOffline: () => void
  /** 处理离线闭关归来 */
  resolveOffline: (mode: 'accept' | 'stone' | 'pill') => void

  meditate: () => void
  seclude: (days: number) => void
  /** 冲击壁垒；plan 仅大境界/渡劫时可选（默认常规） */
  breakthrough: (plan?: TribulationPlanId) => void
  explore: () => void
  clearCombat: () => void
  resolveEvent: (actionId: string) => void
  /** v0.9 结缘后剧情抉择 */
  resolveStory: (choiceId: string | null) => void
  /** 手动触发道侣长线剧情（若可） */
  triggerSpouseStory: () => void
  /** 道侣代劳：打理灵田（每日一次） */
  spouseFarmHelp: () => void
  /** 道侣代劳：代炼低阶丹（每日一次） */
  spousePillHelp: () => void
  /** 接取宗门任务链 */
  acceptQuestChain: (chainId: string) => void
  /** 推进当前任务链（交付/回报/花灵石） */
  advanceQuestStep: () => void
  /** 放弃任务链（进度清空） */
  abandonQuestChain: () => void
  /** 宗主建设升级 */
  upgradeSectBuilding: (which: 'library' | 'market') => void
  /** v1.1 灵石捐献入池 */
  donateToPool: (stones: number) => void
  /** v1.1 宗主拨款：个人贡献 → 池 */
  allocateToPool: (amount: number) => void
  /** v1.1 升级灵脉/丹房/剑冢 */
  upgradeSectBuildingYard: (id: SectBuildingId) => void
  /** 长老「提议」（纯 RP） */
  proposeSectBuilding: (id: SectBuildingId) => void
  /** v1.2 认主/获得灵兽 */
  obtainPet: (petId: string, name?: string) => void
  renamePet: (name: string) => void
  togglePetFight: () => void
  feedPet: () => void
  breakthroughPet: () => void
  setPetJob: (job: PetJob) => void
  releasePet: () => void
  petFarmAssist: () => void
  /** 以 3 张藏经残页参悟一部未习宗门秘法 */
  redeemSectFragment: () => void
  /** v1.4 惰性刷新当日日课（面板挂载与埋点前调用） */
  ensureDaily: () => void
  /** v1.4 领取单条日课奖励（达标后） */
  claimDailyTask: (id: string) => void
  /** v1.4 满 7 日课积分兑换周礼包 */
  claimDailyWeekGift: () => void
  /** v1.4 现实日签到领取 */
  claimCheckin: () => void
  /** v1.4 灵石赎罪：通缉 −1（费用随通缉档与境界上浮） */
  atoneWanted: () => void
  combatAct: (action: PlayerAction) => void
  toggleCombatAuto: () => void
  runCombatAutoToEnd: () => void

  useItem: (id: string) => void
  /** 参悟功法秘籍：消耗秘籍，功法以入门之姿入体 */
  comprehendGongfa: (scrollItemId: string) => void
  /** 消耗修为将功法推进到下一阶段（入门→小成→大成→圆满） */
  advanceGongfaStage: (gongfaId: string) => void
  sellItem: (id: string) => void
  buyItem: (id: string) => void

  buySeed: (seedId: string) => void
  plantSeed: (plotIndex: number, seedId: string) => void
  /** 一键播种：将指定种子种满所有闲置灵田（以库存为上限） */
  plantAll: (seedId: string) => void
  harvestPlot: (plotIndex: number) => void
  /** 一键收获：收下所有已成熟的灵田 */
  harvestAll: () => void
  /** 开拓灵田一列（右侧） */
  expandFarmCol: () => void
  /** 开拓灵田一行（下方） */
  expandFarmRow: () => void
  craftItem: (recipeId: string) => void
  /** v0.8 器阁升级 */
  upgradeForge: () => void
  /** v1.3 聚灵阵扩建：修炼/离线效率每级 +5% */
  upgradeJuling: () => void
  /** 器阁打造法宝 */
  forgeArtifact: (recipeId: string) => void
  /** 洗练词条 */
  refineArtifact: (uid: string) => void
  /** 认主/出战（同类仅一件生效） */
  equipArtifact: (uid: string) => void
  /** 分解法宝胚/法宝，返还材料 */
  decomposeArtifact: (uid: string) => void
  /** 转生；sealed 为可选封印的传承物 */
  reincarnate: (input: CharacterCreateInput, sealed?: SealedItem | null) => void

  joinSect: (sectId: string) => void
  leaveSect: () => void
  sectTask: () => void
  sectExchange: (itemId: string, cost: number) => void
  sectLearn: (libId: string, cost: number) => void
  /** 参与宗门大比：考核型晋升的战斗考核 */
  sectGrandCompetition: () => void
  promoteRank: () => void

  // 秘境爬塔
  enterTower: (realmId: string) => void
  towerFight: () => void
  towerRest: () => void
  towerLeave: () => void

  // 道侣
  chatCompanion: (id: string) => void
  giftCompanion: (id: string, itemId: string) => void
  dualCultivate: (id: string) => void
  propose: (id: string) => void

  advanceDays: (n: number) => void
  /** v1.3 开发调试（方案 §2.7 MVP#8）：?debug=1 时显示 */
  debugAddExp: (n: number) => void
  debugFillExp: () => void
  debugUnlockTowerFloors: () => void
  recoverFull: () => void

  saveToSlot: (slot: number) => boolean
  loadFromSlot: (slot: number) => boolean
  deleteSlot: (slot: number) => void
  slotMeta: (slot: number) => {
    index: number
    name: string
    realmLabel: string
    year: number
    updatedAt: number
    empty: boolean
  }
  exportSave: () => string
  /** 导出加密存档字符串（固定密钥 AES，与桃源乡同构） */
  exportSaveEncrypted: () => string
  /** 从加密/明文字符串导入并进入游戏 */
  importSave: (payload: string) => boolean
  /** 导入文件内容到指定槽位（不解包进游戏，校验后落盘） */
  importSaveToSlot: (slot: number, fileContent: string) => boolean
}

export type MetaSet = (partial: Partial<GameState>) => void
export type MetaGet = () => GameState
