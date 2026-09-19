import { create } from 'zustand'
import { expandPlotCost, MAX_PLOTS, RECIPES, SEEDS } from '../data/abode'
import { CLASSES } from '../data/classes'
import { companionById, giftAffinity, type CompanionDef } from '../data/companions'
import { ENEMIES, pickEnemy } from '../data/enemies'
import { pickWorldEvent, type WorldEvent } from '../data/events'
import {
  GONGFA_STAGE_LABELS,
  GONGFA_STAGE_MUL,
  GONGFAS,
  gongfaAdvanceCost,
  gongfaByScrollId,
  isMarketGongfa,
  canLearnGongfa,
  gongfaRealmText,
} from '../data/gongfa'
import { ITEMS, TREASURE_BONUS, bestBreakthroughPill, pillExp, requiredMaterial, treasureBreakthroughBonus } from '../data/items'
import { REALMS, expNeeded, realmCombatBase, realmIndex, realmLabel, realmMaxEnergy, realmMaxHp } from '../data/realms'
import {
  SECT_RANKS,
  SECTS,
  nextSectRank,
  sectExamOpponent,
  type SectDef,
  type SectRank,
} from '../data/sects'
import {
  SECRET_REALMS,
  canEnterRealm,
  isBossFloor,
  towerEnemy,
} from '../data/secretRealms'
import { BUILTIN_DLC } from '../dlc/builtin'
import { combineRules, loadEnabledDlc, type RuntimeRules } from '../dlc/types'
import {
  applyLayerDown,
  applyLayerUp,
  attemptBreakthrough,
  breakthroughRate,
  canBreakthrough,
} from '../game/breakthrough'
import { repDeltaOnKill } from '../game/combat'
import {
  buildPlayerCombatActor,
  combatResultFromState,
  createCombatState,
  defaultAutoAction,
  getUnlockedPlayerSkills,
  runCombatAuto,
  stepCombat,
  canPaySkill,
  type CombatActor,
  type CombatContext,
  type CombatEngineState,
  type PlayerAction,
} from '../game/combatEngine'
import { COMBAT_CONFIG } from '../data/skills'
import {
  advanceTime,
  cultivateGain,
  dailyRecover,
  dayKey,
  dayNumber,
  seclusionGain,
  weatherOf,
} from '../game/day'
import { canCraft, craftRate, freshAbode, harvestYield, plotProgress } from '../game/farm'
import { clamp } from '../game/format'
import { applyDaoToMaxHp, daoBonuses, reincarnateGain } from '../game/reincarnate'
import { decryptSave, encryptSave } from '../game/saveCrypto'
import type {
  AbodeState,
  CharacterCreateInput,
  EnemyDef,
  GameTime,
  LegacyState,
  PanelId,
  PlayerState,
  TowerRun,
} from '../types'
import { useLogStore } from './useLogStore'

const SAVE_PREFIX = 'wendao-slot-'
const SAVE_VERSION = 7

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
}

export interface SlotSnapshot {
  version: number
  time: GameTime
  player: PlayerState
  stones: number
  inventory: Record<string, number>
  sect: SectState
  treasures: string[]
  companion: CompanionState
  gongfa: GongfaState
  towerBest: Record<string, number>
  abode: AbodeState
  legacy: LegacyState
  updatedAt: number
}

export interface PendingEvent {
  event: WorldEvent
  kind: 'meditate' | 'seclude' | 'explore' | 'tower'
}

function freshSect(): SectState {
  return {
    sectId: null,
    rank: 'menial',
    contribution: 0,
    learned: [],
    taskDoneOn: '',
    examPassed: false,
  }
}

/** 旧存档身份 → 新职位体系（v4 及更早） */
const LEGACY_RANK_MAP: Record<string, SectRank> = {
  menial: 'menial',
  outer: 'outer',
  inner: 'inner',
  personal: 'personal',
  true: 'true',
  steward: 'steward',
  elder: 'elder',
  grand_elder: 'grand_elder',
  master: 'master',
  supreme: 'supreme',
  disciple: 'outer',
}

/** 清理背包中的无效秘籍（宗门秘法不产生秘籍物品，防历史脏数据绕过贡献参悟） */
function sanitizeInventory(inv: Record<string, number>): Record<string, number> {
  const out = { ...inv }
  for (const id of Object.keys(out)) {
    const g = gongfaByScrollId(id)
    if (g && !isMarketGongfa(g)) delete out[id]
  }
  return out
}

function migrateGongfa(raw: unknown, sectLearned?: string[]): GongfaState {  const learned: Record<string, GongfaLearned> = {}
  if (raw && typeof raw === 'object') {
    const r = raw as GongfaState
    if (r.learned && typeof r.learned === 'object') {
      for (const [id, st] of Object.entries(r.learned)) {
        if (!GONGFAS[id] || !st) continue
        learned[id] = { stage: Math.min(3, Math.max(0, Number(st.stage) || 0)) }
      }
    }
  }
  // 旧版宗门藏经阁秘法并入功法体系：参悟即入门
  if (sectLearned) {
    for (const id of sectLearned) {
      if (GONGFAS[id] && !learned[id]) learned[id] = { stage: 0 }
    }
  }
  return { learned }
}

function migrateSect(raw: unknown): SectState {
  const base = freshSect()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<SectState> & { rank?: string }
  return {
    ...base,
    ...r,
    rank: LEGACY_RANK_MAP[r.rank ?? ''] ?? (r.sectId ? 'outer' : 'menial'),
    examPassed: Boolean(r.examPassed),
  }
}

function freshCompanion(): CompanionState {
  return { affinity: {}, heartsSeen: {}, spouseId: null, dualDoneOn: '' }
}

function freshGongfa(): GongfaState {
  return { learned: {} }
}

function freshLegacy(): LegacyState {
  return { daoMarks: 0, reincarnations: 0, bestRealmIndex: 0 }
}

function currentRules(): RuntimeRules {
  return combineRules(BUILTIN_DLC, loadEnabledDlc())
}

function freshPlayer(input: CharacterCreateInput, legacy: LegacyState): PlayerState {
  const c = CLASSES[input.classId]
  const maxHp = applyDaoToMaxHp(realmMaxHp('qi', c.hpMul), legacy.daoMarks)
  const maxEnergy = realmMaxEnergy('qi', input.classId === 'demon')
  return {
    name: input.name.trim() || '无名',
    gender: input.gender,
    classId: input.classId,
    realm: 'qi',
    layer: 1,
    exp: 0,
    hp: maxHp,
    maxHp,
    energy: maxEnergy,
    maxEnergy,
    shaqi: input.classId === 'demon' ? 10 : 0,
    age: 16,
    lifespanLeft: Math.floor(
      REALMS.qi.lifespan * (1 + Math.min(0.3, legacy.daoMarks * 0.001)) * currentRules().lifespanMul,
    ),
    repRight: input.classId === 'demon' ? -20 : 5,
    repDemonic: input.classId === 'demon' ? 40 : 0,
    alive: true,
    ascended: false,
  }
}

function defaultInventory(): Record<string, number> {
  return { pill_qi: 2, pill_heal: 2 }
}

function log(text: string, level: 'info' | 'good' | 'bad' | 'gold' | 'dim' = 'info') {
  useLogStore.getState().push(text, level)
}

function pickEvent(realm: PlayerState['realm']): WorldEvent | null {
  return pickWorldEvent(realm, currentRules().extraEvents)
}

function gainCultivate(classId: PlayerState['classId'], realm: PlayerState['realm'], layer: number): number {
  return Math.floor(cultivateGain(classId, realm, layer) * currentRules().cultivateMul)
}

function gainSeclusion(
  classId: PlayerState['classId'],
  realm: PlayerState['realm'],
  layer: number,
  days: number,
): number {
  return Math.floor(seclusionGain(classId, realm, layer, days) * currentRules().cultivateMul)
}

/** 法宝加成：剑胚攻、宝镜防、镇魂塔气血（同类只计一次，避免重复堆叠爆炸） */
export function treasureBonus(treasures: string[]) {
  let atk = 1
  let def = 1
  let hp = 1
  const seen = new Set<string>()
  for (const id of treasures) {
    if (seen.has(id)) continue
    const b = TREASURE_BONUS[id]
    if (!b) continue
    seen.add(id)
    if (b.atk) atk *= 1 + b.atk
    if (b.def) def *= 1 + b.def
    if (b.hp) hp *= 1 + b.hp
  }
  return { atk, def, hp }
}

/** 已参悟功法的加成（按阶段系数缩放，圆满 1.5 倍）；dodge 为受伤降低（加算） */
export function gongfaBonuses(learned: Record<string, GongfaLearned>) {
  let atk = 1
  let def = 1
  let hp = 1
  let cultivate = 1
  let dodge = 0
  for (const [id, st] of Object.entries(learned)) {
    const g = GONGFAS[id]
    if (!g) continue
    const mul = GONGFA_STAGE_MUL[Math.min(GONGFA_STAGE_MUL.length - 1, st.stage)]
    if (g.effect.atk) atk *= 1 + g.effect.atk * mul
    if (g.effect.def) def *= 1 + g.effect.def * mul
    if (g.effect.hp) hp *= 1 + g.effect.hp * mul
    if (g.effect.cultivate) cultivate *= 1 + g.effect.cultivate * mul
    if (g.effect.dodge) dodge += g.effect.dodge * mul
  }
  return { atk, def, hp, cultivate, dodge }
}

function spouseDef(companion: CompanionState): CompanionDef | null {
  if (!companion.spouseId) return null
  return companionById(companion.spouseId) ?? null
}

function sectDef(id: string | null): SectDef | null {
  if (!id) return null
  return SECTS.find((s) => s.id === id) ?? null
}

function makePlayerCombatant(player: PlayerState, treasures: string[], hpScale = 1): CombatActor {
  const gb = gongfaBonuses(useGameStore.getState().gongfa.learned)
  const tb = treasureBonus(treasures)
  const base = realmCombatBase(player.realm, player.layer)
  return buildPlayerCombatActor({
    name: player.name || '你',
    classId: player.classId,
    realm: player.realm,
    layer: player.layer,
    hp: player.hp,
    maxHp: player.maxHp,
    energy: player.energy,
    maxEnergy: player.maxEnergy,
    atk: Math.floor(base.atk * CLASSES[player.classId].atkMul * tb.atk * gb.atk),
    def: Math.floor(base.def * CLASSES[player.classId].defMul * tb.def * gb.def),
    dmgReduce: gb.dodge,
    treasures,
    hpScale,
  })
}

/** 环境压气血时战斗在缩放坐标系进行；写回真实气血只应扣除实际受伤，不能整段替换为缩放值 */
function realHpAfterScaledCombat(
  playerHp: number,
  hpScale: number,
  combatHpLeft: number,
): number {
  if (hpScale === 1) return combatHpLeft
  const combatStart = Math.floor(playerHp * hpScale)
  const dmg = Math.max(0, combatStart - combatHpLeft)
  return Math.max(0, playerHp - dmg)
}

function startEngineCombat(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
  opts: {
    enemy: EnemyDef
    context: CombatContext
    hpScale?: number
    exploring?: boolean
  },
) {
  const { player, treasures } = get()
  if (!player) return
  const actor = makePlayerCombatant(player, treasures, opts.hpScale ?? 1)
  const state = createCombatState(actor, opts.enemy, opts.context)
  // 开场一律手动：先让 CombatPanel 渲染出来；灵力与存档对齐
  set({
    activeCombat: state,
    autoCombat: false,
    exploring: opts.exploring ?? false,
    lastCombat: null,
    player: {
      ...player,
      energy: Math.min(player.maxEnergy, actor.energy),
    },
  })
}

function applyCombatConsumables(
  state: CombatEngineState,
  inventory: Record<string, number>,
): Record<string, number> {
  const inv = { ...inventory }
  for (const id of state.potionsUsed) {
    if ((inv[id] ?? 0) > 0) {
      inv[id] -= 1
      if (inv[id] <= 0) delete inv[id]
    }
  }
  for (const id of state.blastPillsUsed) {
    if ((inv[id] ?? 0) > 0) {
      inv[id] -= 1
      if (inv[id] <= 0) delete inv[id]
    }
  }
  return inv
}

/** 战斗结束后按场景结算奖励/惩罚，并写回角色 */
function settleActiveCombat(get: () => GameState, set: (p: Partial<GameState>) => void) {
  const state = get().activeCombat
  if (!state || !state.finished) return
  const { player, time } = get()
  if (!player) {
    set({ activeCombat: null, exploring: false })
    return
  }
  const ctx = state.context
  const enemy = ctx.enemy
  const result = combatResultFromState(state)
  const lines = state.log.map((l) => l.text)
  let inv = applyCombatConsumables(state, get().inventory)
  const hpScale = ctx.hpScale ?? 1
  const hpLeft = realHpAfterScaledCombat(player.hp, hpScale, result.playerHpLeft)
  const energyLeft = Math.max(0, Math.min(player.maxEnergy, result.playerEnergyLeft))
  const lifespanLeft = Math.max(1, player.lifespanLeft - result.lifespanCost)
  let nextPlayer: PlayerState = {
    ...player,
    hp: hpLeft,
    energy: energyLeft,
    lifespanLeft,
  }

  if (ctx.kind === 'explore') {
    const advanced = advanceTime(time, 1)
    nextPlayer.age = player.age + advanced.agedYears
    nextPlayer.lifespanLeft = lifespanLeft - advanced.agedYears
    if (result.win) {
      const rep = repDeltaOnKill(enemy)
      const dropRate = enemy.loot.dropRate ?? 1
      const stoneMul = currentRules().exploreStoneMul
      if (result.itemId && ITEMS[result.itemId] && Math.random() < dropRate) {
        inv[result.itemId] = (inv[result.itemId] ?? 0) + 1
        lines.push(`获得「${ITEMS[result.itemId].name}」×1`)
      }
      if (Math.random() < 0.12) {
        inv.tiger_bone = (inv.tiger_bone ?? 0) + 1
        lines.push('获得「虎王骨」×1')
      }
      const stoneGain = Math.floor(result.stoneGain * stoneMul)
      log(`历练遭遇 ${enemy.name}，获胜。`, 'good')
      log(`修为 +${result.expGain}，灵石 +${stoneGain}`, 'good')
      if (enemy.faction === 'demonic') {
        log(`斩杀魔修：正道声望 +${rep.right}，魔道声望 +${rep.demonic}`, 'dim')
      }
      nextPlayer = {
        ...nextPlayer,
        exp: player.exp + result.expGain,
        repRight: player.repRight + rep.right,
        repDemonic: player.repDemonic + rep.demonic,
        shaqi:
          player.classId === 'demon'
            ? clamp(player.shaqi + (enemy.faction === 'beast' ? 2 : 5), 0, 100)
            : player.shaqi,
      }
      set({
        time: advanced.time,
        stones: get().stones + stoneGain,
        inventory: inv,
        exploring: false,
        activeCombat: null,
        lastCombat: { enemy, win: true, log: lines },
        player: nextPlayer,
      })
    } else {
      log(`历练遭遇 ${enemy.name}，不敌败退。`, 'bad')
      set({
        time: advanced.time,
        exploring: false,
        activeCombat: null,
        lastCombat: { enemy, win: false, log: lines },
        stones: Math.max(0, get().stones - 15),
        player: {
          ...nextPlayer,
          hp: Math.max(1, result.playerHpLeft > 0 ? hpLeft : Math.floor(player.maxHp * 0.15)),
        },
      })
    }
    const evt = pickEvent(player.realm)
    if (evt) set({ pendingEvent: { event: evt, kind: 'explore' } })
    return
  }

  if (ctx.kind === 'tower') {
    const { tower } = get()
    const realm = tower ? SECRET_REALMS.find((r) => r.id === tower.realmId) : null
    if (!tower || !realm) {
      set({ activeCombat: null, exploring: false })
      return
    }
    const boss = isBossFloor(realm, tower.floor)
    if (result.win) {
      if (result.itemId && Math.random() < (enemy.loot.dropRate ?? 0)) {
        inv[result.itemId] = (inv[result.itemId] ?? 0) + 1
        lines.push(`获得「${ITEMS[result.itemId]?.name}」`)
      }
      const best = Math.max(get().towerBest[realm.id] ?? 0, tower.floor)
      const clearedAll = tower.floor >= realm.floors
      log(
        `秘境通关第 ${tower.floor} 层${boss ? '（镇守）' : ''}：修为 +${result.expGain}，灵石 +${result.stoneGain}`,
        'gold',
      )
      set({
        inventory: inv,
        stones: get().stones + result.stoneGain,
        activeCombat: null,
        lastCombat: { enemy, win: true, log: lines },
        towerBest: { ...get().towerBest, [realm.id]: best },
        tower: clearedAll
          ? { ...tower, left: true, log: lines, inCombat: false }
          : { ...tower, floor: tower.floor + 1, inCombat: false, log: lines },
        player: {
          ...nextPlayer,
          exp: player.exp + result.expGain,
        },
      })
      if (clearedAll) log(`你贯通了「${realm.name}」全部 ${realm.floors} 层！`, 'gold')
      return
    }
    log(`秘境第 ${tower.floor} 层不敌，被迫退出。`, 'bad')
    set({
      activeCombat: null,
      lastCombat: { enemy, win: false, log: lines },
      tower: null,
      player: {
        ...nextPlayer,
        hp: Math.max(
          1,
          result.playerHpLeft > 0 ? hpLeft : Math.floor(player.maxHp * 0.12),
        ),
      },
    })
    return
  }

  if (ctx.kind === 'sect_exam') {
    const { sect, time: t2 } = get()
    const advanced = advanceTime(t2, 1)
    const aged = player.age + advanced.agedYears
    const nextId = nextSectRank(sect.rank)
    const nextRank = nextId ? SECT_RANKS[nextId] : null
    if (result.win) {
      log(`宗门大比：你力克${enemy.name}，通过「${nextRank?.name ?? '晋升'}」考核！`, 'gold')
      log(`修为 +${result.expGain}。考核通过，凭此可直接晋升。`, 'good')
      set({
        time: advanced.time,
        activeCombat: null,
        lastCombat: { enemy, win: true, log: lines },
        sect: { ...sect, examPassed: true },
        player: {
          ...nextPlayer,
          exp: player.exp + result.expGain,
          hp: Math.max(1, hpLeft),
          age: aged,
          lifespanLeft: nextPlayer.lifespanLeft - advanced.agedYears,
        },
      })
    } else {
      log(`宗门大比不敌${enemy.name}，考核未过。调养之后再战。`, 'bad')
      set({
        time: advanced.time,
        activeCombat: null,
        lastCombat: { enemy, win: false, log: lines },
        player: {
          ...nextPlayer,
          hp: Math.max(1, result.playerHpLeft > 0 ? hpLeft : Math.floor(player.maxHp * 0.15)),
          age: aged,
          lifespanLeft: nextPlayer.lifespanLeft - advanced.agedYears,
        },
      })
    }
    return
  }

  // event 等其它场景：仅写回战斗结果
  set({
    activeCombat: null,
    lastCombat: { enemy, win: result.win, log: lines },
    player: nextPlayer,
  })
}

/** 按功法/法宝加成与道痕重算气血灵力上限（参悟、进阶、突破、法宝变动后调用） */
function recomputeVitals(
  p: PlayerState,
  treasures: string[],
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
): PlayerState {
  const c = CLASSES[p.classId]
  const gb = gongfaBonuses(gongfaLearned)
  const tb = treasureBonus(treasures)
  const baseHp = realmMaxHp(p.realm, c.hpMul, p.layer)
  const maxHp = applyDaoToMaxHp(Math.floor(baseHp * gb.hp * tb.hp), daoMarks)
  const maxEnergy = realmMaxEnergy(p.realm, p.classId === 'demon', p.layer)
  return {
    ...p,
    maxHp,
    maxEnergy,
    hp: Math.min(p.hp, maxHp),
    energy: Math.min(p.energy, maxEnergy),
  }
}

/** 按当前境界/功法/法宝/道痕推导的气血上限（读档补足用） */
function playerMaxHpCap(
  p: PlayerState,
  treasures: string[],
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
): number {
  const c = CLASSES[p.classId]
  const gb = gongfaBonuses(gongfaLearned)
  const tb = treasureBonus(treasures)
  const baseHp = realmMaxHp(p.realm, c.hpMul, p.layer)
  return applyDaoToMaxHp(Math.floor(baseHp * gb.hp * tb.hp), daoMarks)
}

interface GameState {
  phase: GamePhase
  time: GameTime
  player: PlayerState | null
  stones: number
  inventory: Record<string, number>
  sect: SectState
  treasures: string[]
  companion: CompanionState
  /** 已参悟功法 */
  gongfa: GongfaState
  /** 各秘境最高通关层 */
  towerBest: Record<string, number>
  tower: TowerRun | null
  abode: AbodeState
  legacy: LegacyState
  activePanel: PanelId
  exploring: boolean
  lastCombat: { enemy: EnemyDef; win: boolean; log: string[] } | null
  pendingEvent: PendingEvent | null
  /** 进行中的回合制战斗（v0.6 技能战） */
  activeCombat: (CombatEngineState & { pendingEventAction?: string }) | null
  autoCombat: boolean

  setPanel: (p: PanelId) => void
  startCreate: () => void
  createCharacter: (input: CharacterCreateInput) => void
  backToMenu: () => void

  meditate: () => void
  seclude: (days: number) => void
  breakthrough: () => void
  explore: () => void
  clearCombat: () => void
  resolveEvent: (actionId: string) => void
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
  expandPlot: () => void
  craftItem: (recipeId: string) => void
  reincarnate: (input: CharacterCreateInput) => void

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

function snapshotOf(s: GameState): SlotSnapshot {
  return {
    version: SAVE_VERSION,
    time: s.time,
    player: s.player!,
    stones: s.stones,
    inventory: s.inventory,
    sect: s.sect,
    treasures: s.treasures,
    companion: s.companion,
    gongfa: s.gongfa,
    towerBest: s.towerBest,
    abode: s.abode,
    legacy: s.legacy,
    updatedAt: Date.now(),
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  time: { year: 1, month: 1, day: 1 },
  player: null,
  stones: 80,
  inventory: defaultInventory(),
  sect: freshSect(),
  treasures: [],
  companion: freshCompanion(),
  gongfa: freshGongfa(),
  towerBest: {},
  tower: null,
  abode: freshAbode(),
  legacy: freshLegacy(),
  activePanel: 'cultivate',
  exploring: false,
  lastCombat: null,
  pendingEvent: null,
  activeCombat: null,
  /** 默认手动，保证战斗面板能先显示；勾选自动后再托管 */
  autoCombat: false,

  setPanel: (p) => set({ activePanel: p }),
  startCreate: () => {
    const { player, companion, legacy } = get()
    // 若此世已终结，先结算道痕再开新身
    if (player && (!player.alive || player.ascended)) {
      const gain = reincarnateGain(player, Boolean(companion.spouseId))
      const nextLegacy: LegacyState = {
        daoMarks: legacy.daoMarks + gain.daoMarks,
        reincarnations: legacy.reincarnations + 1,
        bestRealmIndex: Math.max(legacy.bestRealmIndex, realmIndex(player.realm)),
      }
      log(`此世终结。结算道痕 +${gain.daoMarks}（${gain.desc}）。`, 'gold')
      set({
        legacy: nextLegacy,
        phase: 'create',
        player: null,
        lastCombat: null,
        pendingEvent: null,
        tower: null,
        sect: freshSect(),
        companion: freshCompanion(),
      gongfa: freshGongfa(),
        treasures: [],
        abode: freshAbode(),
        activePanel: 'cultivate',
        activeCombat: null,
        exploring: false,
        autoCombat: false,
      })
      return
    }
    useLogStore.getState().clear()
    set({ phase: 'create' })
  },

  backToMenu: () => {
    useLogStore.getState().clear()
    set({
      phase: 'menu',
      player: null,
      lastCombat: null,
      pendingEvent: null,
      tower: null,
      activeCombat: null,
      exploring: false,
      activePanel: 'cultivate',
      sect: freshSect(),
      companion: freshCompanion(),
      gongfa: freshGongfa(),
      treasures: [],
      towerBest: {},
      abode: freshAbode(),
      // 保留道痕与转生次数，跨周目继承
    })
  },

  createCharacter: (input) => {
    const legacy = get().legacy
    const player = freshPlayer(input, legacy)
    const dao = daoBonuses(legacy.daoMarks)
    const abode = freshAbode()
    while (abode.plots.length < Math.min(MAX_PLOTS, abode.plots.length + dao.startPlotsBonus)) {
      abode.plots.push({ seedId: null, plantedDay: 0 })
    }
    log(`你名 ${player.name}，踏上修行之路。职业：${CLASSES[player.classId].name}。`, 'gold')
    log(`初始寿元 ${player.lifespanLeft} 年。${dayKey(get().time)}，天朗气清。`, 'dim')
    if (legacy.daoMarks > 0) {
      log(`道痕 ${legacy.daoMarks}：修炼加速、突破略易，起始灵石更丰。`, 'dim')
    }
    set({
      phase: 'play',
      player,
      time: { year: 1, month: 1, day: 1 },
      stones: dao.startStones,
      inventory: defaultInventory(),
      sect: freshSect(),
      companion: freshCompanion(),
      gongfa: freshGongfa(),
      treasures: [],
      towerBest: {},
      tower: null,
      abode,
      activePanel: 'cultivate',
      lastCombat: null,
      pendingEvent: null,
      activeCombat: null,
      exploring: false,
      autoCombat: false,
    })
  },

  meditate: () => {
    const { player, time, sect, companion } = get()
    if (!player || !player.alive || player.ascended || get().pendingEvent || get().tower || get().activeCombat) return
    const sdef = sectDef(sect.sectId)
    const rankBonus = SECT_RANKS[sect.rank].cultivateMul
    const gongfaMul = gongfaBonuses(get().gongfa.learned).cultivate
    const spouse = spouseDef(companion)
    const dao = daoBonuses(get().legacy.daoMarks)
    let gain = gainCultivate(player.classId, player.realm, player.layer)
    gain = Math.floor(
      gain *
        dao.cultivateMul *
        (sdef?.bonus.cultivateMul ?? 1) *
        rankBonus *
        gongfaMul *
        (spouse ? 1 + (spouse.dualMul - 1) * 0.35 : 1),
    )
    const need = expNeeded(player.realm, player.layer)
    const rec = dailyRecover(player.maxHp, player.maxEnergy)
    const advanced = advanceTime(time, 1)
    const aged = player.age + advanced.agedYears
    const lifespanLeft = player.lifespanLeft - advanced.agedYears
    log(
      `${dayKey(time)} 打坐吐纳，修为 +${gain}（${player.exp + gain}/${need}）。天气：${weatherOf(time)}`,
      'good',
    )

    if (lifespanLeft <= 0) {
      log('寿元耗尽，道消身陨……', 'bad')
      set({
        time: advanced.time,
        player: { ...player, exp: player.exp + gain, age: aged, lifespanLeft: 0, alive: false },
      })
      return
    }

    set({
      time: advanced.time,
      player: {
        ...player,
        exp: player.exp + gain,
        hp: Math.min(player.maxHp, player.hp + rec.hp),
        energy: Math.min(player.maxEnergy, player.energy + rec.energy),
        age: aged,
        lifespanLeft,
      },
    })

    const evt = pickEvent(player.realm)
    if (evt) set({ pendingEvent: { event: evt, kind: 'meditate' } })
  },

  seclude: (days) => {
    const n = clamp(days, 1, 3650)
    const { player, time, sect, companion } = get()
    if (!player || !player.alive || player.ascended || get().pendingEvent || get().tower || get().activeCombat) return
    const sdef = sectDef(sect.sectId)
    const rankBonus = SECT_RANKS[sect.rank].cultivateMul
    const gongfaMul = gongfaBonuses(get().gongfa.learned).cultivate
    const spouse = spouseDef(companion)
    const dao = daoBonuses(get().legacy.daoMarks)
    let gain = gainSeclusion(player.classId, player.realm, player.layer, n)
    gain = Math.floor(
      gain *
        dao.cultivateMul *
        (sdef?.bonus.cultivateMul ?? 1) *
        rankBonus *
        gongfaMul *
        (spouse ? 1 + (spouse.dualMul - 1) * 0.35 : 1),
    )
    const advanced = advanceTime(time, n)
    const aged = player.age + advanced.agedYears
    const life = player.lifespanLeft - advanced.agedYears
    const need = expNeeded(player.realm, player.layer)
    log(`闭关 ${n} 日，修为 +${gain}（${player.exp + gain}/${need}）。`, 'good')

    if (life <= 0) {
      log('闭关中寿元耗尽，坐化于洞府……', 'bad')
      set({
        time: advanced.time,
        player: { ...player, exp: player.exp + gain, age: aged, lifespanLeft: 0, alive: false },
      })
      return
    }

    const rec = dailyRecover(player.maxHp, player.maxEnergy)
    set({
      time: advanced.time,
      player: {
        ...player,
        exp: player.exp + gain,
        hp: Math.min(player.maxHp, player.hp + rec.hp * Math.min(n, 20)),
        energy: player.maxEnergy,
        age: aged,
        lifespanLeft: life,
      },
    })

    const evt = pickEvent(player.realm)
    if (evt) set({ pendingEvent: { event: evt, kind: 'seclude' } })
  },

  breakthrough: () => {
    const { player, inventory, sect, companion, treasures } = get()
    if (!player || !player.alive || player.ascended || get().tower || get().activeCombat) return
    if (!canBreakthrough(player.realm, player.layer, player.exp)) {
      log('修为不足，无法冲击壁垒。', 'bad')
      return
    }

    const def = REALMS[player.realm]
    const isMajor = player.layer >= def.layers
    const matId = requiredMaterial(player.realm, player.layer)
    if (isMajor && matId && (inventory[matId] ?? 0) <= 0) {
      log(`冲击${def.name}圆满需要「${ITEMS[matId].name}」，请历练或秘境获取。`, 'bad')
      return
    }

    const sdef = sectDef(sect.sectId)
    const spouse = spouseDef(companion)
    const spouseBonus = spouse?.breakthroughBonus ?? 0
    const dao = daoBonuses(get().legacy.daoMarks)
    // 突破法宝（认主常驻，同类不叠加）+ 最佳突破丹药（本次消耗）+ 渡劫令持有
    const treasureBt = treasureBreakthroughBonus(treasures)
    const breakPill = bestBreakthroughPill(inventory)
    const pillBt = breakPill?.rate ?? 0
    const tribTokenBt = (inventory.mat_tribulation ?? 0) > 0 ? 5 : 0
    const rate = Math.min(
      95,
      breakthroughRate(player.classId, player.realm) +
        (sdef?.bonus.breakthroughBonus ?? 0) +
        spouseBonus +
        dao.breakthroughBonus +
        treasureBt +
        pillBt +
        tribTokenBt +
        currentRules().breakthroughRateDelta,
    )
    const roll = Math.random() * 100
    // 用含宗门/道侣/法宝/丹药加成后的 rate 重判，保证 severity 与展示一致
    const result = attemptBreakthrough(player.classId, player.realm, player.layer, roll)
    const success = roll < rate
    const need = expNeeded(player.realm, player.layer)

    // 冲击壁垒自动消耗一枚突破丹（无论成败）
    const inv = { ...inventory }
    if (breakPill) {
      inv[breakPill.id] = (inv[breakPill.id] ?? 1) - 1
      if (inv[breakPill.id] <= 0) delete inv[breakPill.id]
    }

    if (success) {
      const next = applyLayerUp(player.realm, player.layer)
      if (isMajor && matId) {
        inv[matId] = (inv[matId] ?? 1) - 1
        if (inv[matId] <= 0) delete inv[matId]
      }
      const vitals = recomputeVitals(
        { ...player, realm: next.realm, layer: next.layer },
        treasures,
        get().gongfa.learned,
        get().legacy.daoMarks,
      )
      log(result.message, 'gold')
      if (spouse) log(`${spouse.name}在旁护法，心脉安稳。`, 'dim')
      if (breakPill) log(`服用「${breakPill.name}」，药力护持破关。`, 'dim')
      if (treasureBt > 0) log(`认主法宝加持：突破成功率 +${treasureBt}%`, 'dim')
      if (tribTokenBt > 0) log('渡劫令微光流转，稳住道基。', 'dim')
      log(`（成功率约 ${Math.round(rate)}%）`, 'dim')
      set({
        inventory: inv,
        player: {
          ...vitals,
          realm: next.realm,
          layer: next.layer,
          exp: Math.max(0, player.exp - need),
          hp: vitals.maxHp,
          energy: vitals.maxEnergy,
          lifespanLeft: Math.max(
            player.lifespanLeft,
            Math.floor(REALMS[next.realm].lifespan * currentRules().lifespanMul),
          ),
        },
      })
      return
    }

    // 失败文案按调整后 rate 重新描述 severity
    let severity = result.severity
    const isTribulation = player.realm === 'tribulation' || player.realm === 'mahayana'
    if (isTribulation && roll > rate + 35) severity = 'critical'
    else if (isMajor && roll >= rate) severity = 'major'
    else severity = 'minor'

    const failMsg =
      severity === 'critical'
        ? '天劫反噬，道基崩裂！重伤并损失大量修为。'
        : severity === 'major'
          ? `突破${def.name}圆满失败，气血逆冲，境界跌落一层。`
          : '冲击壁垒失败，经脉受损，损失部分修为与气血。'
    log(failMsg, 'bad')
    if (breakPill) log(`服用「${breakPill.name}」，药力仍未能扭转乾坤。`, 'dim')
    log(`（成功率约 ${Math.round(rate)}%）`, 'dim')
    let next = { realm: player.realm, layer: player.layer }
    let exp = Math.floor(player.exp * 0.55)
    let hp = player.hp
    let lifespanLeft = player.lifespanLeft

    if (severity === 'minor') {
      hp = Math.max(1, Math.floor(player.hp * 0.55))
    } else if (severity === 'major') {
      next = applyLayerDown(player.realm, player.layer)
      hp = Math.max(1, Math.floor(player.hp * 0.35))
      exp = Math.floor(player.exp * 0.4)
    } else {
      next = applyLayerDown(player.realm, player.layer)
      hp = 1
      exp = 0
      lifespanLeft = Math.max(1, lifespanLeft - Math.floor(REALMS[player.realm].lifespan * 0.05))
    }

    set({
      inventory: inv,
      player: { ...player, realm: next.realm, layer: next.layer, exp, hp, lifespanLeft },
    })
  },

  explore: () => {
    const { player, time } = get()
    if (!player || !player.alive || player.ascended || get().exploring || get().pendingEvent || get().tower || get().activeCombat)
      return
    const ri = realmIndex(player.realm)
    const enemy = pickEnemy(ri < 0 ? 0 : ri, player.layer)
    startEngineCombat(get, set, {
      enemy,
      context: {
        kind: 'explore',
        title: `历练 · 第${time.year}年${time.month}月${time.day}日`,
        enemy,
        hpScale: 1,
        exploreDay: true,
      },
      hpScale: 1,
      exploring: true,
    })
  },

  clearCombat: () => set({ lastCombat: null }),

  toggleCombatAuto: () => {
    set({ autoCombat: !get().autoCombat })
  },

  combatAct: (action) => {
    const { activeCombat, player, inventory } = get()
    if (!activeCombat || activeCombat.finished || !player) return

    let inv = inventory
    if (action.type === 'potion') {
      if ((inv[action.itemId] ?? 0) <= 0) return
    }
    if (action.type === 'skill') {
      const skills = getUnlockedPlayerSkills(player.classId, player.realm, player.layer)
      const sk = skills.find((s) => s.id === action.skillId)
      if (!sk || !canPaySkill(activeCombat, sk)) return
    }

    const state = stepCombat(activeCombat, action, inv, player.realm, player.layer)
    // 深拷贝一层，确保 zustand 能触发 React 更新
    const next: CombatEngineState = {
      ...state,
      player: { ...state.player, statuses: state.player.statuses.map((s) => ({ ...s })), skillCd: { ...state.player.skillCd } },
      enemy: { ...state.enemy, statuses: state.enemy.statuses.map((s) => ({ ...s })), skillCd: { ...state.enemy.skillCd } },
      log: [...state.log],
    }
    // 灵力实时回写存档（战斗结算时再统一写回气血等；气血可能经环境压缩，勿在此写）
    const syncedEnergy = Math.max(0, Math.min(player.maxEnergy, next.player.energy))
    set({
      activeCombat: next,
      player: { ...player, energy: syncedEnergy },
    })

    if (next.finished) {
      settleActiveCombat(get, set)
    }
  },

  runCombatAutoToEnd: () => {
    const { activeCombat, player, inventory } = get()
    if (!activeCombat || activeCombat.finished || !player) return
    let state: CombatEngineState = activeCombat
    let inv = inventory
    const cfg = COMBAT_CONFIG
    let guard = 0
    while (!state.finished && guard < cfg.maxRounds + 8) {
      guard += 1
      const action = defaultAutoAction(state, inv, player.realm, player.layer)
      if (action.type === 'potion' && (inv[action.itemId] ?? 0) <= 0) {
        state = stepCombat(state, { type: 'attack' }, inv, player.realm, player.layer)
      } else {
        state = stepCombat(state, action, inv, player.realm, player.layer)
      }
      inv = applyCombatConsumables(state, inv)
      state = { ...state, potionsUsed: [], blastPillsUsed: [] }
    }
    const syncedEnergy = Math.max(0, Math.min(player.maxEnergy, state.player.energy))
    set({
      activeCombat: {
        ...state,
        player: { ...state.player, statuses: [...state.player.statuses] },
        enemy: { ...state.enemy, statuses: [...state.enemy.statuses] },
        log: [...state.log],
      },
      inventory: inv,
      player: get().player ? { ...get().player!, energy: syncedEnergy } : player,
    })
    if (state.finished) settleActiveCombat(get, set)
  },

  buySeed: (seedId) => {
    const { stones, inventory, player } = get()
    const seed = SEEDS[seedId]
    if (!seed || !player || stones < seed.seedPrice) return
    const inv = { ...inventory }
    inv[seedId] = (inv[seedId] ?? 0) + 1
    log(`购入「${seed.name}」×1，花费灵石 ${seed.seedPrice}`, 'dim')
    set({ inventory: inv, stones: stones - seed.seedPrice })
  },

  plantSeed: (plotIndex, seedId) => {
    const { abode, inventory, player, time } = get()
    if (!player || !player.alive || player.ascended) return
    const plot = abode.plots[plotIndex]
    if (!plot || plot.seedId) return
    const seed = SEEDS[seedId]
    if (!seed || (inventory[seedId] ?? 0) <= 0) {
      log('没有种子。', 'bad')
      return
    }
    const inv = { ...inventory }
    inv[seedId] -= 1
    if (inv[seedId] <= 0) delete inv[seedId]
    const plots = abode.plots.map((p, i) =>
      i === plotIndex ? { seedId, plantedDay: dayNumber(time) } : p,
    )
    log(`在灵田种下「${seed.name}」，约 ${seed.growDays} 日可熟。`, 'good')
    set({ inventory: inv, abode: { plots } })
  },

  harvestPlot: (plotIndex) => {
    const { abode, inventory, player, time } = get()
    if (!player || !player.alive) return
    const plot = abode.plots[plotIndex]
    if (!plot?.seedId) return
    const prog = plotProgress(plot, time)
    if (!prog.ready) {
      log('尚未成熟。', 'dim')
      return
    }
    const seed = SEEDS[plot.seedId]
    const amount = harvestYield(plot.seedId)
    const inv = { ...inventory }
    inv[seed.yieldItemId] = (inv[seed.yieldItemId] ?? 0) + amount
    const plots = abode.plots.map((p, i) => (i === plotIndex ? { seedId: null, plantedDay: 0 } : p))
    log(`收获「${ITEMS[seed.yieldItemId]?.name ?? seed.yieldItemId}」×${amount}。`, 'gold')
    set({ inventory: inv, abode: { plots } })
  },

  plantAll: (seedId) => {
    const { abode, inventory, player, time } = get()
    if (!player || !player.alive || player.ascended) return
    const seed = SEEDS[seedId]
    if (!seed) return
    if ((inventory[seedId] ?? 0) <= 0) {
      log('没有这种种子。', 'bad')
      return
    }
    const emptyIdx = abode.plots.map((p, i) => (!p.seedId ? i : -1)).filter((i) => i >= 0)
    if (emptyIdx.length === 0) {
      log('没有闲置的灵田。', 'dim')
      return
    }
    const n = Math.min(inventory[seedId] ?? 0, emptyIdx.length)
    const inv = { ...inventory }
    inv[seedId] = (inv[seedId] ?? 0) - n
    if (inv[seedId] <= 0) delete inv[seedId]
    const plantedDay = dayNumber(time)
    // 只种前 n 块空田（受库存数量限制）
    const targetSet = new Set(emptyIdx.slice(0, n))
    const plots = abode.plots.map((p, i) => (targetSet.has(i) ? { seedId, plantedDay } : p))
    log(`一键播种「${seed.name}」×${n}，约 ${seed.growDays} 日可熟。`, 'good')
    set({ inventory: inv, abode: { plots } })
  },

  harvestAll: () => {
    const { abode, inventory, player, time } = get()
    if (!player || !player.alive) return
    const totals: Record<string, number> = {}
    let count = 0
    const inv = { ...inventory }
    const plots = abode.plots.map((plot) => {
      if (!plot.seedId) return plot
      const prog = plotProgress(plot, time)
      if (!prog.ready) return plot
      const seed = SEEDS[plot.seedId]
      const amount = harvestYield(plot.seedId)
      inv[seed.yieldItemId] = (inv[seed.yieldItemId] ?? 0) + amount
      totals[seed.yieldItemId] = (totals[seed.yieldItemId] ?? 0) + amount
      count += 1
      return { seedId: null, plantedDay: 0 }
    })
    if (count === 0) {
      log('没有可收获的灵植。', 'dim')
      return
    }
    const detail =
      Object.entries(totals)
        .map(([id, n]) => `${ITEMS[id]?.name ?? id}×${n}`)
        .join('、') || '无'
    log(`一键收获 ${count} 块灵田：${detail}。`, 'gold')
    set({ inventory: inv, abode: { plots } })
  },

  expandPlot: () => {
    const { abode, stones, player } = get()
    if (!player || !player.alive) return
    if (abode.plots.length >= MAX_PLOTS) return
    const cost = expandPlotCost(abode.plots.length)
    if (stones < cost) {
      log('灵石不足，无法扩建。', 'bad')
      return
    }
    log(`开垦新灵田，花费灵石 ${cost}。`, 'gold')
    set({
      stones: stones - cost,
      abode: { plots: [...abode.plots, { seedId: null, plantedDay: 0 }] },
    })
  },

  craftItem: (recipeId) => {
    const { player, inventory, time } = get()
    if (!player || !player.alive || player.ascended) return
    const recipe = RECIPES[recipeId]
    if (!recipe) return
    if (!canCraft(recipe, inventory)) {
      log('药材不足。', 'bad')
      return
    }
    const rate = craftRate(recipe, player.classId, get().legacy.daoMarks)
    const inv = { ...inventory }
    for (const input of recipe.inputs) {
      inv[input.itemId] = (inv[input.itemId] ?? 0) - input.count
      if (inv[input.itemId] <= 0) delete inv[input.itemId]
    }
    const advanced = advanceTime(time, recipe.craftDays)
    const aged = player.age + advanced.agedYears
    const life = player.lifespanLeft - advanced.agedYears
    if (life <= 0) {
      set({
        time: advanced.time,
        inventory: inv,
        player: { ...player, age: aged, lifespanLeft: 0, alive: false },
      })
      log('炼丹耗神，寿元耗尽……', 'bad')
      return
    }
    const success = Math.random() * 100 < rate
    if (success) {
      inv[recipe.outputItemId] = (inv[recipe.outputItemId] ?? 0) + recipe.outputCount
      log(
        `丹成！「${ITEMS[recipe.outputItemId]?.name ?? recipe.outputItemId}」×${recipe.outputCount}`,
        'gold',
      )
    } else {
      log('炉火失控，药材尽废……', 'bad')
    }
    set({
      time: advanced.time,
      inventory: inv,
      player: { ...player, age: aged, lifespanLeft: life },
    })
  },

  reincarnate: (input) => {
    const { player, companion, legacy } = get()
    if (!player || (player.alive && !player.ascended)) {
      log('此身尚在修行，无需转生。', 'dim')
      return
    }
    const gain = reincarnateGain(player, Boolean(companion.spouseId))
    const nextLegacy: LegacyState = {
      daoMarks: legacy.daoMarks + gain.daoMarks,
      reincarnations: legacy.reincarnations + 1,
      bestRealmIndex: Math.max(legacy.bestRealmIndex, realmIndex(player.realm)),
    }
    log(`此世终结。结算道痕 +${gain.daoMarks}（${gain.desc}）。`, 'gold')
    log(`转生次数 ${nextLegacy.reincarnations}，累计道痕 ${nextLegacy.daoMarks}。择新身再修。`, 'gold')
    set({ legacy: nextLegacy })
    get().createCharacter(input)
  },

  resolveEvent: (actionId) => {
    const { pendingEvent, player, inventory, stones, treasures } = get()
    if (!pendingEvent || !player || !player.alive) {
      set({ pendingEvent: null })
      return
    }
    const evt = pendingEvent.event
    let inv = { ...inventory }

    if (actionId === 'ignore' || actionId === 'flee') {
      log(`你选择避开：${evt.title}`, 'dim')
      set({ pendingEvent: null })
      return
    }

    if (actionId === 'take' || actionId === 'claim') {
      if (evt.payload?.itemId) {
        inv[evt.payload.itemId] = (inv[evt.payload.itemId] ?? 0) + 1
        const isTreasure = evt.payload.itemId.startsWith('treasure_')
        const t = isTreasure ? [...treasures, evt.payload.itemId] : treasures
        log(
          `奇遇「${evt.title}」：获得${ITEMS[evt.payload.itemId]?.name ?? evt.payload.itemId}`,
          'gold',
        )
        set({
          pendingEvent: null,
          inventory: inv,
          treasures: t,
          stones: stones + (evt.payload.stone ?? 0),
          player: { ...player, exp: player.exp + (evt.payload.exp ?? 0) },
        })
        if (isTreasure) {
          // 法宝认主后立即生效（如镇魂塔加气血上限）
          useGameStore.setState({
            player: recomputeVitals(
              useGameStore.getState().player!,
              t,
              useGameStore.getState().gongfa.learned,
              useGameStore.getState().legacy.daoMarks,
            ),
          })
        }
        return
      }
      log(
        `奇遇「${evt.title}」：灵石 +${evt.payload?.stone ?? 0}，修为 +${evt.payload?.exp ?? 0}`,
        'gold',
      )
      set({
        pendingEvent: null,
        stones: stones + (evt.payload?.stone ?? 0),
        player: { ...player, exp: player.exp + (evt.payload?.exp ?? 0) },
      })
      return
    }

    if (actionId === 'enter' || actionId === 'fight') {
      const bossId =
        evt.payload?.bossId ??
        (evt.id.includes('ice') ? 'boss_ape' : evt.id.includes('demon') ? 'boss_demon_lord' : 'boss_tiger')
      const enemy = ENEMIES.find((e) => e.id === bossId) ?? ENEMIES[0]
      const actor = makePlayerCombatant(player, treasures, 1)
      const label = actionId === 'enter' ? '秘境探索' : '奇遇战斗'
      const result = runCombatAuto(
        actor,
        enemy,
        {
          kind: 'event',
          title: `${label}：${evt.title}`,
          enemy,
          hpScale: 1,
        },
        inv,
        player.realm,
        player.layer,
        (st) => defaultAutoAction(st, inv, player.realm, player.layer),
      )
      inv = applyCombatConsumables(
        {
          potionsUsed: result.potionsUsed,
          blastPillsUsed: result.blastPillsUsed,
        } as CombatEngineState,
        inv,
      )
      const lines = result.log.map((l) => l.text)
      if (result.win) {
        const dropId = enemy.loot.itemId
        if (dropId && Math.random() < (enemy.loot.dropRate ?? 0.6)) {
          inv[dropId] = (inv[dropId] ?? 0) + 1
        }
        const rep = repDeltaOnKill(enemy)
        log(`${label}获胜：${enemy.name}`, 'gold')
        log(`修为 +${result.expGain}，灵石 +${result.stoneGain}`, 'good')
        set({
          pendingEvent: null,
          inventory: inv,
          stones: get().stones + result.stoneGain,
          lastCombat: { enemy, win: true, log: lines },
          player: {
            ...player,
            exp: player.exp + result.expGain,
            hp: Math.max(1, result.playerHpLeft),
            energy: result.playerEnergyLeft,
            lifespanLeft: Math.max(1, player.lifespanLeft - result.lifespanCost),
            repRight: player.repRight + rep.right,
            repDemonic: player.repDemonic + rep.demonic,
          },
        })
      } else {
        log(`${label}失败：${enemy.name}`, 'bad')
        set({
          pendingEvent: null,
          inventory: inv,
          lastCombat: { enemy, win: false, log: lines },
          stones: Math.max(0, get().stones - 20),
          player: {
            ...player,
            hp: Math.max(1, Math.floor(player.maxHp * 0.15)),
            energy: result.playerEnergyLeft,
            lifespanLeft: Math.max(1, player.lifespanLeft - result.lifespanCost),
          },
        })
      }
      return
    }

    set({ pendingEvent: null })
  },

  useItem: (id) => {
    const { player, inventory } = get()
    if (!player || !player.alive) return
    const count = inventory[id] ?? 0
    const item = ITEMS[id]
    if (count <= 0 || !item?.effect) return
    // 突破辅助丹药：冲击壁垒时自动选用并消耗，不可提前服用
    if (item.effect.breakthroughRate && !item.effect.hp && !item.effect.exp) {
      log(`「${item.name}」将在冲击壁垒时自动服用（成功率 +${item.effect.breakthroughRate}%）。`, 'dim')
      return
    }
    const inv = { ...inventory, [id]: count - 1 }
    if (inv[id] <= 0) delete inv[id]
    const p = { ...player }
    if (item.effect.hp) p.hp = Math.min(p.maxHp, p.hp + item.effect.hp)
    if (item.effect.exp) {
      const gain = id === 'pill_qi' ? pillExp(player.realm) : item.effect.exp
      p.exp += gain
      log(`服用 ${item.name}，修为 +${gain}`, 'good')
    } else if (item.effect.hp) {
      log(`服用 ${item.name}，气血恢复。`, 'good')
    } else {
      log(`使用 ${item.name}。`, 'good')
    }
    set({ player: p, inventory: inv })
  },

  comprehendGongfa: (scrollItemId) => {
    const { inventory, player, gongfa, treasures, legacy } = get()
    if (!player || !player.alive) return
    const g = gongfaByScrollId(scrollItemId)
    if (!g) return
    if ((inventory[scrollItemId] ?? 0) <= 0) {
      log('背包中没有这部秘籍。', 'bad')
      return
    }
    if (gongfa.learned[g.id]) {
      log('此功法已在修习之中。', 'dim')
      return
    }
    if (!canLearnGongfa(g, player.realm)) {
      log(`参悟《${g.name}》需先达${gongfaRealmText(g)}，你现为${REALMS[player.realm]?.name}。`, 'bad')
      return
    }
    const inv = { ...inventory }
    inv[scrollItemId] = (inv[scrollItemId] ?? 0) - 1
    if (inv[scrollItemId] <= 0) delete inv[scrollItemId]
    const learned = { ...gongfa.learned, [g.id]: { stage: 0 } }
    const p = recomputeVitals({ ...player }, treasures, learned, legacy.daoMarks)
    log(`你翻开《${g.name}》，朝夕参诵，功法入门。`, 'gold')
    set({ inventory: inv, gongfa: { learned }, player: p })
  },

  advanceGongfaStage: (id) => {
    const { player, gongfa, treasures, legacy } = get()
    if (!player || !player.alive) return
    const g = GONGFAS[id]
    if (!g) return
    const st = gongfa.learned[id]
    if (!st) {
      log('尚未参悟此功法。', 'bad')
      return
    }
    if (st.stage >= GONGFA_STAGE_LABELS.length - 1) {
      log('此功法已臻圆满，进境无可复加。', 'dim')
      return
    }
    const cost = gongfaAdvanceCost(g, st.stage)
    if (player.exp < cost) {
      log(`进阶「${GONGFA_STAGE_LABELS[st.stage + 1]}」需消耗修为 ${cost}，当前修为不足。`, 'bad')
      return
    }
    const learned = { ...gongfa.learned, [id]: { stage: st.stage + 1 } }
    const p = recomputeVitals({ ...player, exp: player.exp - cost }, treasures, learned, legacy.daoMarks)
    log(`修为灌顶，《${g.name}》修至「${GONGFA_STAGE_LABELS[st.stage + 1]}」！`, 'gold')
    set({ player: p, gongfa: { learned } })
  },

  sellItem: (id) => {
    const { inventory, stones, treasures, player, gongfa, legacy } = get()
    const count = inventory[id] ?? 0
    const item = ITEMS[id]
    if (count <= 0 || !item || !player) return
    // 唯一不可出售的：宗门秘法（非坊市流通的功法）
    const scrollG = gongfaByScrollId(id)
    if (scrollG && !isMarketGongfa(scrollG)) {
      log('宗门功法乃传承之物，不可转售。', 'bad')
      return
    }
    const inv = { ...inventory, [id]: count - 1 }
    if (inv[id] <= 0) delete inv[id]
    const price = Math.floor(item.price * 0.55)
    // 出售认主法宝会失去加成：只扣一件，同类保留
    const isTreasure = id.startsWith('treasure_')
    let newTreasures = treasures
    if (isTreasure) {
      const idx = treasures.indexOf(id)
      if (idx >= 0) {
        newTreasures = [...treasures.slice(0, idx), ...treasures.slice(idx + 1)]
      }
    }
    let p = player
    if (isTreasure && treasures.includes(id)) {
      p = recomputeVitals({ ...player }, newTreasures, gongfa.learned, legacy.daoMarks)
    }
    log(`出售 ${item.name}，得灵石 +${price}`, 'dim')
    set({ inventory: inv, stones: stones + price, treasures: newTreasures, player: p })
  },

  buyItem: (id) => {
    const { inventory, stones, player, treasures } = get()
    const item = ITEMS[id]
    if (!item || stones < item.price || !player) return
    const inv = { ...inventory }
    inv[id] = (inv[id] ?? 0) + 1
    // 法宝购入即认主；同类多件全部计入列表，便于背包按 ×N 展示
    const isTreasure = id.startsWith('treasure_')
    const newTreasures = isTreasure ? [...treasures, id] : treasures
    const bought = { ...get().player!, stones: stones - item.price }
    const p = isTreasure ? recomputeVitals(bought, newTreasures, get().gongfa.learned, get().legacy.daoMarks) : bought
    log(`购入 ${item.name}，花费灵石 ${item.price}`, 'dim')
    set({
      inventory: inv,
      stones: stones - item.price,
      treasures: newTreasures,
      player: p,
    })
  },

  joinSect: (sectId) => {
    const { player, sect } = get()
    if (!player || sect.sectId) return
    const s = SECTS.find((x) => x.id === sectId)
    if (!s) return
    if (s.alignment === 'righteous' && player.classId === 'demon') {
      log(`${s.name}守山大阵感应到你的魔功，将你拒之门外。`, 'bad')
      return
    }
    if (s.alignment === 'demonic' && player.repRight > 30 && player.repDemonic < 10) {
      log(`${s.name}怀疑你是正道细作，暂不收留。`, 'bad')
      return
    }
    log(`你拜入「${s.name}」，自杂役弟子做起。`, 'gold')
    set({ sect: { ...sect, sectId, rank: 'menial', contribution: 0, examPassed: false } })
  },

  leaveSect: () => {
    const { sect } = get()
    if (!sect.sectId) return
    log('你退出了宗门，贡献清零。', 'dim')
    set({ sect: freshSect() })
  },

  sectTask: () => {
    const { player, sect, time, stones } = get()
    if (!player || !sect.sectId || !player.alive) return
    const key = `${time.year}-${time.month}-${time.day}`
    if (sect.taskDoneOn === key) {
      log('今日宗门任务已完成。', 'dim')
      return
    }
    const rankMul = SECT_RANKS[sect.rank].taskMul
    const gain = Math.floor((15 + Math.floor(Math.random() * 20)) * rankMul)
    const stone = 20 + Math.floor(Math.random() * 30)
    const advanced = advanceTime(time, 1)
    log(`完成宗门委托：贡献 +${gain}，灵石 +${stone}`, 'good')
    set({
      time: advanced.time,
      stones: stones + stone,
      sect: { ...sect, contribution: sect.contribution + gain, taskDoneOn: key },
      player: {
        ...player,
        age: player.age + advanced.agedYears,
        lifespanLeft: player.lifespanLeft - advanced.agedYears,
      },
    })
  },

  sectExchange: (itemId, cost) => {
    const { sect, inventory } = get()
    if (!sect.sectId || sect.contribution < cost) {
      log('贡献不足。', 'bad')
      return
    }
    const inv = { ...inventory }
    inv[itemId] = (inv[itemId] ?? 0) + 1
    log(`以贡献兑换「${ITEMS[itemId]?.name ?? itemId}」。`, 'gold')
    set({ inventory: inv, sect: { ...sect, contribution: sect.contribution - cost } })
  },

  sectLearn: (libId, cost) => {
    const { sect, player, gongfa, treasures, legacy } = get()
    if (!sect.sectId || sect.contribution < cost || !player) {
      log('贡献不足或未入门。', 'bad')
      return
    }
    const g = GONGFAS[libId]
    if (!g) return
    if (gongfa.learned[libId]) {
      log('此功法已在修习之中。', 'dim')
      return
    }
    if (!canLearnGongfa(g, player.realm)) {
      log(`参悟《${g.name}》需先达${gongfaRealmText(g)}，你现为${REALMS[player.realm]?.name}。`, 'bad')
      return
    }
    const learned = { ...gongfa.learned, [libId]: { stage: 0 } }
    const p = recomputeVitals({ ...player }, treasures, learned, legacy.daoMarks)
    log(`藏经阁中灵光乍现，《${g.name}》参悟入门。`, 'gold')
    set({
      player: p,
      gongfa: { learned },
      sect: { ...sect, contribution: sect.contribution - cost },
    })
  },

  sectGrandCompetition: () => {
    const { player, sect, treasures } = get()
    if (!player || !player.alive || player.ascended || get().pendingEvent || get().tower || get().activeCombat) return
    if (!sect.sectId) return
    const nextId = nextSectRank(sect.rank)
    const next = nextId ? SECT_RANKS[nextId] : null
    if (!next || next.entry !== 'exam') {
      log('当前职位晋升无需大比考核。', 'dim')
      return
    }
    if (sect.examPassed) {
      log('你已通过本届大比，可直接晋升。', 'dim')
      return
    }
    const tier = next.examTier ?? 1
    const enemy = sectExamOpponent(player.realm, player.layer, tier)
    const actor = makePlayerCombatant(player, treasures, 1)
    const state = createCombatState(actor, enemy, {
      kind: 'sect_exam',
      title: `宗门大比 · ${next.name}晋升考核`,
      enemy,
      hpScale: 1,
    })
    set({
      activeCombat: state,
      autoCombat: false,
      lastCombat: null,
      pendingEvent: null,
      player: {
        ...player,
        energy: Math.min(player.maxEnergy, actor.energy),
      },
    })
  },

  promoteRank: () => {
    const { sect, player } = get()
    if (!sect.sectId) return
    const nextId = nextSectRank(sect.rank)
    if (!nextId) {
      log('你已是太上长老，宗门之中再无高位。', 'gold')
      return
    }
    const next = SECT_RANKS[nextId]
    // 宗主→太上长老等自由晋升：不校验贡献/大比/境界，也不扣贡献
    const freePromote = next.entry === 'optional' || next.entry === 'none'
    if (!freePromote) {
      if (sect.contribution < next.entryCost) {
        log(`晋升「${next.name}」需贡献 ${next.entryCost}，当前 ${sect.contribution}。`, 'bad')
        return
      }
      if (next.entry === 'exam' && !sect.examPassed) {
        log(`晋升「${next.name}」需先在宗门大比中胜出。`, 'bad')
        return
      }
      if (next.entry === 'realm' && next.realmReq && player) {
        const req = next.realmReq
        if (
          realmIndex(player.realm) < realmIndex(req.realm) ||
          (player.realm === req.realm && player.layer < req.layer)
        ) {
          log(
            `晋升「${next.name}」需修为达到${realmLabel(req.realm, req.layer)}，你现为${realmLabel(player.realm, player.layer)}。`,
            'bad',
          )
          return
        }
      }
    }
    const consumedExam = !freePromote && next.entry === 'exam'
    set({
      sect: {
        ...sect,
        rank: nextId,
        contribution: freePromote ? sect.contribution : sect.contribution - next.entryCost,
        examPassed: consumedExam ? false : sect.examPassed,
      },
    })
    log(`宗门晋升：你已成为「${next.name}」。`, 'gold')
    if (consumedExam) log('大比魁首之名已用于此次晋升。', 'dim')
    if (next.entry === 'optional') {
      log('你自宗主之位退居太上，不问俗务，逍遥自在。', 'gold')
    }
  },

  enterTower: (realmId) => {
    const { player, tower } = get()
    if (!player || !player.alive || player.ascended || tower) return
    const realm = SECRET_REALMS.find((r) => r.id === realmId)
    if (!realm) return
    if (!canEnterRealm(realm, player.realm, player.layer)) {
      log(`境界不足，无法进入「${realm.name}」。`, 'bad')
      return
    }
    const best = get().towerBest[realmId] ?? 0
    const startFloor = best > 0 ? Math.min(best + 1, realm.floors) : 1
    log(`踏入秘境「${realm.name}」第 ${startFloor} 层。`, 'gold')
    set({
      tower: { realmId, floor: startFloor, inCombat: false, log: [], left: false },
      lastCombat: null,
    })
  },

  towerFight: () => {
    const { tower, player, treasures, companion } = get()
    if (!tower || !player || !player.alive || tower.left || get().activeCombat) return
    const realm = SECRET_REALMS.find((r) => r.id === tower.realmId)
    if (!realm) return
    const boss = isBossFloor(realm, tower.floor)
    const enemy = towerEnemy(realm.id, tower.floor, boss)
    const hpScale = realm.env.playerHpMul ?? 1
    const actor = makePlayerCombatant(player, treasures, hpScale)
    const spouse = spouseDef(companion)
    if (spouse) actor.atk = Math.floor(actor.atk * 1.08)
    const state = createCombatState(actor, enemy, {
      kind: 'tower',
      title: `秘境 ${realm.name} · 第${tower.floor}层${boss ? '（镇守）' : ''}`,
      enemy,
      hpScale,
    })
    set({
      activeCombat: state,
      autoCombat: false,
      lastCombat: null,
      tower: { ...tower, inCombat: true },
      player: {
        ...player,
        energy: Math.min(player.maxEnergy, actor.energy),
      },
    })
  },

  towerRest: () => {
    const { tower, player, time } = get()
    if (!tower || !player || !player.alive) return
    const rec = dailyRecover(player.maxHp, player.maxEnergy)
    const advanced = advanceTime(time, 1)
    log(`在秘境石台调息一日，气血与灵力有所恢复。`, 'dim')
    set({
      time: advanced.time,
      tower: { ...tower, log: [...tower.log, '你盘坐调息，灵雾入体。'] },
      player: {
        ...player,
        hp: Math.min(player.maxHp, player.hp + rec.hp * 2),
        energy: Math.min(player.maxEnergy, player.energy + rec.energy * 2),
        age: player.age + advanced.agedYears,
        lifespanLeft: player.lifespanLeft - advanced.agedYears,
      },
    })
  },

  towerLeave: () => {
    const { tower } = get()
    if (!tower) return
    log('你退出了秘境，已通关层数保留。', 'dim')
    set({ tower: null })
  },

  chatCompanion: (id) => {
    const { companion, player } = get()
    if (!player || !player.alive) return
    const c = companionById(id)
    if (!c) return
    const gain = 2 + Math.floor(Math.random() * 3)
    const prev = companion.affinity[id] ?? 0
    const next = prev + gain
    let seen = companion.heartsSeen[id] ?? 0
    const heartTexts: string[] = []
    while (seen < c.heartAt.length && next >= c.heartAt[seen]) {
      heartTexts.push(c.heartTexts[seen] ?? '')
      seen += 1
    }
    log(`与${c.name}闲谈，好感 +${gain}（${next}）。`, 'good')
    heartTexts.forEach((t) => t && log(`心事件：${t}`, 'gold'))
    set({
      companion: {
        ...companion,
        affinity: { ...companion.affinity, [id]: next },
        heartsSeen: { ...companion.heartsSeen, [id]: seen },
      },
    })
  },

  giftCompanion: (id, itemId) => {
    const { companion, inventory, player } = get()
    if (!player) return
    const c = companionById(id)
    if (!c) return
    if ((inventory[itemId] ?? 0) <= 0) {
      log('背包中没有此物。', 'bad')
      return
    }
    if (c.align === 'righteous' && itemId === 'demon_shard') {
      log(`${c.name}蹙眉：「这煞气之物，我不能收。」`, 'bad')
      return
    }
    if (c.align === 'demonic' && itemId === 'pill_qi' && Math.random() < 0.4) {
      log(`${c.name}冷笑：「正道丹药，瞧不上。」`, 'bad')
      return
    }
    const gain = giftAffinity(c, itemId)
    const inv = { ...inventory, [itemId]: (inventory[itemId] ?? 1) - 1 }
    if (inv[itemId] <= 0) delete inv[itemId]
    const prev = companion.affinity[id] ?? 0
    const next = prev + gain
    let seen = companion.heartsSeen[id] ?? 0
    const heartTexts: string[] = []
    while (seen < c.heartAt.length && next >= c.heartAt[seen]) {
      heartTexts.push(c.heartTexts[seen] ?? '')
      seen += 1
    }
    log(`赠${ITEMS[itemId]?.name ?? itemId}予${c.name}，好感 +${gain}（${next}）。`, 'good')
    heartTexts.forEach((t) => t && log(`心事件：${t}`, 'gold'))
    set({
      inventory: inv,
      companion: {
        ...companion,
        affinity: { ...companion.affinity, [id]: next },
        heartsSeen: { ...companion.heartsSeen, [id]: seen },
      },
    })
  },

  dualCultivate: (id) => {
    const { companion, player, time } = get()
    if (!player || !player.alive || player.ascended) return
    const c = companionById(id)
    if (!c) return
    const aff = companion.affinity[id] ?? 0
    if (aff < 40) {
      log(`${c.name}与你尚不熟稔，婉拒双修。`, 'bad')
      return
    }
    if (companion.spouseId && companion.spouseId !== id) {
      log('你已有道侣，不宜与他人双修。', 'bad')
      return
    }
    const key = `${time.year}-${time.month}-${time.day}`
    if (companion.dualDoneOn === key) {
      log('今日双修已毕，灵力需沉淀。', 'dim')
      return
    }
    // 正魔恋惩罚
    const isCross =
      (player.classId === 'demon' && c.align === 'righteous') ||
      (player.classId !== 'demon' && c.align === 'demonic' && player.repRight > 20)
    if (isCross && aff < 80) {
      log(`正魔殊途，${c.name}仍心存顾虑。`, 'bad')
      return
    }

    const base = gainCultivate(player.classId, player.realm, player.layer)
    const gain = Math.floor(base * c.dualMul * 2)
    const advanced = advanceTime(time, 1)
    const life = player.lifespanLeft - advanced.agedYears
    if (life <= 0) {
      set({
        time: advanced.time,
        player: { ...player, age: player.age + 1, lifespanLeft: 0, alive: false },
      })
      log('双修中寿元耗尽……', 'bad')
      return
    }
    log(`与${c.name}双修一夜，修为 +${gain}。`, 'gold')
    set({
      time: advanced.time,
      companion: { ...companion, dualDoneOn: key },
      player: {
        ...player,
        exp: player.exp + gain,
        energy: player.maxEnergy,
        hp: Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.3)),
        age: player.age + advanced.agedYears,
        lifespanLeft: life,
      },
    })
  },

  propose: (id) => {
    const { companion, player, stones } = get()
    if (!player) return
    const c = companionById(id)
    if (!c) return
    const aff = companion.affinity[id] ?? 0
    if (companion.spouseId) {
      log('你已有道侣。', 'bad')
      return
    }
    if (aff < c.marryAt) {
      log(`${c.name}：「再相处些时日吧。」（需好感 ${c.marryAt}，当前 ${aff}）`, 'bad')
      return
    }
    if (stones < 200) {
      log('结缘需置办双修洞府与礼数，灵石不足 200。', 'bad')
      return
    }
    // 正魔恋需更高好感
    const isCross =
      (player.classId === 'demon' && c.align === 'righteous') ||
      (player.classId !== 'demon' && c.align === 'demonic')
    if (isCross && aff < c.marryAt + 40) {
      log(`正魔之恋阻力极大，${c.name}还需更多坚定。（需好感 ${c.marryAt + 40}）`, 'bad')
      return
    }
    log(`${c.name}应允了。自此结为道侣，祸福与共。`, 'gold')
    set({
      stones: stones - 200,
      companion: { ...companion, spouseId: id },
    })
  },

  advanceDays: (n) => {
    const { player, time } = get()
    if (!player) return
    const advanced = advanceTime(time, n)
    const age = player.age + advanced.agedYears
    const life = player.lifespanLeft - advanced.agedYears
    const rec = dailyRecover(player.maxHp, player.maxEnergy)
    log(`光阴流转，${n} 日已过。`, 'dim')
    if (life <= 0) {
      set({ time: advanced.time, player: { ...player, age, lifespanLeft: 0, alive: false } })
      return
    }
    set({
      time: advanced.time,
      player: {
        ...player,
        age,
        lifespanLeft: life,
        hp: Math.min(player.maxHp, player.hp + rec.hp * n),
        energy: Math.min(player.maxEnergy, player.energy + rec.energy * n),
      },
    })
  },

  recoverFull: () => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, hp: player.maxHp, energy: player.maxEnergy } })
    log('灵力回满，气血充盈。', 'dim')
  },

  saveToSlot: (slot) => {
    const { player } = get()
    if (!player) return false
    try {
      const plain = JSON.stringify(snapshotOf(get()))
      localStorage.setItem(SAVE_PREFIX + slot, encryptSave(plain))
      log(`已存入存档位 ${slot}。`, 'gold')
      return true
    } catch {
      log('存档失败：本地存储不可用。', 'bad')
      return false
    }
  },

  loadFromSlot: (slot) => {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot)
      if (!raw) return false
      const json = decryptSave(raw) ?? (raw.startsWith('{') ? raw : null)
      if (!json) return false
      const snap = JSON.parse(json) as SlotSnapshot
      if (!snap?.player) return false
      useLogStore.getState().clear()
      log(
        `读取存档位 ${slot}：${snap.player.name} · ${realmLabel(snap.player.realm, snap.player.layer)}`,
        'gold',
      )
      const migratedSect = migrateSect(snap.sect)
      const migratedGongfa = migrateGongfa(snap.gongfa, migratedSect.learned)
      migratedSect.learned = []
      const maxHp = Math.max(
        snap.player.maxHp,
        playerMaxHpCap(snap.player, snap.treasures ?? [], migratedGongfa.learned, snap.legacy?.daoMarks ?? 0),
      )
      const maxEnergy = Math.max(
        snap.player.maxEnergy,
        realmMaxEnergy(snap.player.realm, snap.player.classId === 'demon', snap.player.layer),
      )
      const lifespanFloor = REALMS[snap.player.realm].lifespan
      const wasFullHp = snap.player.hp >= snap.player.maxHp - 1
      const wasFullEn = snap.player.energy >= snap.player.maxEnergy - 1
      set({
        phase: 'play',
        time: snap.time,
        player: {
          ...snap.player,
          maxHp,
          maxEnergy,
          // 曲线调整后：原先满血/满灵的角色读档即按新上限回满
          hp: wasFullHp ? maxHp : Math.min(maxHp, snap.player.hp),
          energy: wasFullEn ? maxEnergy : Math.min(maxEnergy, snap.player.energy),
          lifespanLeft: Math.max(snap.player.lifespanLeft, Math.floor(lifespanFloor * 0.3)),
        },
        stones: snap.stones,
        inventory: sanitizeInventory(snap.inventory),
        sect: migratedSect,
        treasures: snap.treasures ?? [],
        companion: snap.companion ?? freshCompanion(),
        gongfa: migratedGongfa,
        towerBest: snap.towerBest ?? {},
        abode: snap.abode ?? freshAbode(),
        legacy: snap.legacy ?? freshLegacy(),
        tower: null,
        lastCombat: null,
        pendingEvent: null,
        activePanel: 'cultivate',
      })
      return true
    } catch {
      return false
    }
  },

  deleteSlot: (slot) => {
    localStorage.removeItem(SAVE_PREFIX + slot)
  },

  slotMeta: (slot) => {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot)
      if (!raw) {
        return { index: slot, name: '', realmLabel: '', year: 0, updatedAt: 0, empty: true }
      }
      const json = decryptSave(raw) ?? (raw.startsWith('{') ? raw : null)
      if (!json) {
        return { index: slot, name: '', realmLabel: '', year: 0, updatedAt: 0, empty: true }
      }
      const snap = JSON.parse(json) as SlotSnapshot
      return {
        index: slot,
        name: snap.player.name,
        realmLabel: realmLabel(snap.player.realm, snap.player.layer),
        year: snap.time.year,
        updatedAt: snap.updatedAt,
        empty: false,
      }
    } catch {
      return { index: slot, name: '', realmLabel: '', year: 0, updatedAt: 0, empty: true }
    }
  },

  exportSave: () => {
    const { player } = get()
    if (!player) return ''
    return JSON.stringify(snapshotOf(get()))
  },

  exportSaveEncrypted: () => {
    const { player } = get()
    if (!player) throw new Error('NO_PLAYER')
    return encryptSave(JSON.stringify(snapshotOf(get())))
  },

  importSave: (payload) => {
    try {
      let json = payload.trim()
      if (!json) return false
      const decrypted = decryptSave(json)
      if (decrypted) json = decrypted
      else if (!json.startsWith('{')) return false
      const snap = JSON.parse(json) as SlotSnapshot
      if (!snap?.player?.name) return false
      const migratedSect = migrateSect(snap.sect)
      const migratedGongfa = migrateGongfa(snap.gongfa, migratedSect.learned)
      migratedSect.learned = []
      set({
        phase: 'play',
        time: snap.time,
        player: snap.player,
        stones: snap.stones ?? 0,
        inventory: sanitizeInventory(snap.inventory ?? {}),
        sect: migratedSect,
        treasures: snap.treasures ?? [],
        companion: snap.companion ?? freshCompanion(),
        gongfa: migratedGongfa,
        towerBest: snap.towerBest ?? {},
        abode: snap.abode ?? freshAbode(),
        legacy: snap.legacy ?? freshLegacy(),
        tower: null,
        lastCombat: null,
        pendingEvent: null,
      })
      log('存档导入成功。', 'gold')
      return true
    } catch {
      log('导入失败：存档文件已损坏。', 'bad')
      return false
    }
  },

  importSaveToSlot: (slot, fileContent) => {
    if (slot < 0 || slot > 3) return false
    try {
      let json = fileContent.trim()
      const decrypted = decryptSave(json)
      if (decrypted) json = decrypted
      else if (!json.startsWith('{')) return false
      const snap = JSON.parse(json) as SlotSnapshot
      if (!snap?.player?.name) return false
      // 统一存为密文
      localStorage.setItem(SAVE_PREFIX + slot, encryptSave(json))
      return true
    } catch {
      return false
    }
  },
}))
