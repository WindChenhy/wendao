import { create } from 'zustand'
import { expandColCost, expandRowCost, canExpandFarmCols, canExpandFarmRows, RECIPES, SEEDS, SEED_LIST } from '../data/abode'
import {
  ACHIEVEMENT_MAP,
  describeReward as describeAchieveReward,
  evaluateAchievementIds,
} from '../data/achievements'
import { CLASSES } from '../data/classes'
import {
  CODEX_PAGE_META,
  codexRewardKey,
  pendingCodexRewards,
  describeCodexReward,
} from '../data/codex'
import {
  companionById,
  giftAffinity,
  nextStoryBeat,
  storyEndingKey,
  type CompanionDef,
  type StoryChoice,
} from '../data/companions'
import { ENEMIES, ENEMY_TEMPLATES, enemyTemplateId, pickEnemy } from '../data/enemies'
import {
  pickWorldEvent,
  type EventGateContext,
  type EventOutcome,
  type WorldEvent,
  type WorldEventAction,
} from '../data/events'
import {
  questChainById,
  questStepMatchesDeliver,
  availableQuestChains,
} from '../data/sectQuests'
import {
  GONGFA_STAGE_LABELS,
  GONGFAS,
  gongfaAdvanceCost,
  gongfaByScrollId,
  isMarketGongfa,
  canLearnGongfaFull,
  gongfaScopeText,
  gongfaRealmText,
} from '../data/gongfa'
import { ITEMS, bestBreakthroughPill, itemEffectWithMarks, itemMinRealmOk, itemOverScope, itemScopeText, itemTierText, pillExp, requiredMaterial } from '../data/items'
import {
  REALMS,
  expNeeded,
  realmCombatBase,
  realmIndex,
  realmLabel,
  realmMaxEnergy,
  realmMaxHp,
} from '../data/realms'
import {
  SECT_RANKS,
  SECTS,
  nextSectRank,
  sectRankIndex,
  sectExamOpponent,
  type SectDef,
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
  GAME_DAYS_PER_YEAR,
  advanceTime,
  cultivateGain,
  dailyRecover,
  dayKey,
  dayNumber,
  seclusionGain,
  weatherOf,
} from '../game/day'
import {
  OFFLINE_PILL_BONUS,
  OFFLINE_PILL_IDS,
  calcOfflineCultivation,
  formatOfflineDuration,
  type OfflineSettlement,
} from '../game/offline'
import { canCraft, craftRate, freshAbode, harvestYield, migrateAbode, plotProgress, remapFarmPlots } from '../game/farm'
import {
  type ArtifactInstance,
  type ArtifactQuality,
  ARTIFACT_RECIPES,
  createArtifactInstance,
  artifactDisplayName,
  decomposeYield,
  describeAffix,
  describeArtifact,
  forgeLevelDef,
  refineCost,
  rollAffixIds,
} from '../data/artifacts'
import {
  canForge,
  consumeForgeMaterials,
  performCraft,
} from '../game/artifactCraft'

function ARTIFACT_CRAFT_DAYS(recipeId: string): number {
  return ARTIFACT_RECIPES.find((r) => r.id === recipeId)?.craftDays ?? 2
}
import { clamp } from '../game/format'
import {
  applyDaoToMaxHp,
  daoBonuses,
  isAscended,
  reincarnateGain,
} from '../game/reincarnate'
import { sealDaoCost, sealSlots, type SealedItem } from '../game/seal'
import {
  isTribulationMoment,
  softenSeverity,
  tribulationPlan,
  type TribulationPlanId,
} from '../data/tribulation'
import { makeArtifactUid } from '../data/artifacts'
import { decryptSave, encryptSave } from '../game/saveCrypto'
import { loadGameSettings, saveGameSettings } from '../game/settings'
import type {
  AbodeState,
  CharacterCreateInput,
  CodexPageId,
  EnemyDef,
  GameTime,
  LegacyState,
  MetaState,
  PanelId,
  PlayerState,
  TowerRun,
} from '../types'
import {
  type CompanionState,
  type GamePhase,
  type GongfaLearned,
  type GongfaState,
  type OfflinePending,
  type PendingEvent,
  type PendingStory,
  type SectState,
  type SlotSnapshot,
} from './gameStateTypes'
export type { OfflinePending, GamePhase, GongfaLearned, GongfaState, SectState, CompanionState, PendingStory, SlotSnapshot, PendingEvent } from './gameStateTypes'
import {
  defaultInventory,
  deriveCollectionFromState,
  freshCompanion,
  freshGongfa,
  freshLegacy,
  freshMeta,
  freshSect,
  mergeCollection,
  migrateCompanion,
  migrateGongfa,
  migrateLegacy,
  migrateMeta,
  migratePet,
  migrateSect,
  sanitizeInventory,
  uniqIds,
} from './saveMigrate'
import {
  artifactBattleExtras,
  gongfaBonuses,
  treasureBonus,
  treasureBreakthroughTotal,
} from '../game/combatStats'
import { TUNING } from '../game/tuning'
import {
  PET_FEED_EXP,
  PET_FARM_ASSIST_MUL,
  PET_MAP,
  PET_MAX_LEVEL,
  PET_GUARD_LOSS_REDUCE,
  petExpNeed,
  petStatBonus,
  type PetJob,
  type PetState,
} from '../data/pets'
import {
  SECT_BUILDING_MAP,
  buildingAtkMul,
  buildingCraftRateBonus,
  buildingCultivateMul,
  buildingLevel,
  buildingUpgradeCost,
  commissionPoolCutOf,
  stonesToPool,
  type SectBuildingId,
} from '../data/sectBuildings'
import { playBell, playChime } from '../game/sfx'
import { useLogStore } from './useLogStore'

const SAVE_PREFIX = 'wendao-slot-'
const SAVE_VERSION = TUNING.saveVersion

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

function log(text: string, level: 'info' | 'good' | 'bad' | 'gold' | 'dim' = 'info') {
  useLogStore.getState().push(text, level)
}

function buildEventContext(s: {
  player: PlayerState | null
  time: GameTime
  sect: SectState
  companion: CompanionState
}): EventGateContext | null {
  const p = s.player
  if (!p) return null
  return {
    realm: p.realm,
    layer: p.layer,
    classId: p.classId,
    year: s.time.year,
    repRight: p.repRight,
    repDemonic: p.repDemonic,
    sectId: s.sect.sectId,
    sectRank: s.sect.rank,
    spouseId: s.companion.spouseId,
    affinity: s.companion.affinity,
    flags: s.companion.flags,
  }
}

function pickEvent(): WorldEvent | null {
  const s = useGameStore.getState()
  const ctx = buildEventContext(s)
  if (!ctx) return null
  return pickWorldEvent(ctx, currentRules().extraEvents)
}

/** 任务链：历练/秘境获胜推进 explore_win 步骤 */
function bumpQuestExploreWin(set: MetaSet) {
  const { sect } = useGameStore.getState()
  if (!sect.sectId || !sect.quest) return
  const chain = questChainById(sect.quest.chainId)
  if (!chain) return
  const step = chain.steps[sect.quest.stepIndex]
  if (!step || step.type !== 'explore_win') return
  const need = step.count ?? 1
  const progress = sect.quest.progress + 1
  if (progress >= need) {
    set({
      sect: {
        ...sect,
        quest: {
          ...sect.quest,
          stepIndex: sect.quest.stepIndex + 1,
          progress: 0,
          completedSteps: sect.quest.completedSteps + 1,
        },
      },
    })
    log(`任务链「${chain.name}」：${step.desc} —— 已完成。`, 'good')
  } else {
    set({ sect: { ...sect, quest: { ...sect.quest, progress } } })
    log(`任务链「${chain.name}」：${step.desc}（${progress}/${need}）`, 'dim')
  }
}

/** 结缘后剧情：有可触发段则弹出 */
function maybeTriggerSpouseStory(get: MetaGet, set: MetaSet) {
  const s = get()
  if (!s.player || s.pendingEvent || s.pendingStory || s.activeCombat) return
  const spouseId = s.companion.spouseId
  if (!spouseId) return
  const c = companionById(spouseId)
  if (!c?.postStory?.length) return
  const stage = s.companion.postStage[spouseId] ?? 0
  if (stage >= c.postStory.length) return
  const beat = nextStoryBeat(c, stage)
  if (!beat) return
  set({ pendingStory: { companionId: spouseId, beat } })
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

/** 合并修炼倍率：道痕 / 宗门 / 职位 / 功法 / 道侣（与打坐一致） */
function cultivateMultipliers(
  player: PlayerState | null,
  sect: SectState,
  companion: CompanionState,
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
): number {
  if (!player) return 1
  const sdef = sectDef(sect.sectId)
  const rankBonus = SECT_RANKS[sect.rank]?.cultivateMul ?? 1
  const gongfaMul = gongfaBonuses(gongfaLearned, useGameStore.getState().player?.realm).cultivate * buildingCultivateMul(sect.buildings)
  const spouse = spouseDef(companion)
  const dao = daoBonuses(daoMarks)
  return (
    dao.cultivateMul *
    (sdef?.bonus.cultivateMul ?? 1) *
    rankBonus *
    gongfaMul *
    (spouse ? 1 + (spouse.dualMul - 1) * 0.35 : 1) *
    currentRules().cultivateMul
  )
}

type MetaSet = (partial: Partial<GameState>) => void
type MetaGet = () => GameState

/** 记录图鉴条目；若有新解锁则继续跑图鉴奖励与成就 */
function unlockCodex(get: MetaGet, set: MetaSet, page: CodexPageId, id: string) {
  if (!id) return
  const meta = get().meta
  if (meta.collection[page]?.includes(id)) return
  const collection = {
    ...meta.collection,
    [page]: [...(meta.collection[page] ?? []), id],
  }
  const pageMeta = CODEX_PAGE_META[page]
  log(`图鉴收录：「${pageMeta.name}」新条目。`, 'dim')
  set({ meta: { ...meta, collection } })
  processMetaProgress(get, set)
}

/** 结算图鉴节点奖励与新达成的成就（自动入账 + 日志） */
function processMetaProgress(get: MetaGet, set: MetaSet) {
  const state = get()
  const meta = state.meta
  let stones = state.stones
  let legacy = state.legacy
  let claimed = [...meta.codexRewardClaimed]
  let titles = [...meta.titles]
  let achievements = [...meta.achievements]
  let stats = { ...meta.stats, stonesPeak: Math.max(meta.stats.stonesPeak, stones) }

  const codexHits = pendingCodexRewards(meta.collection, claimed)
  for (const hit of codexHits) {
    claimed.push(codexRewardKey(hit.page, hit.pct))
    if (hit.reward.stones) stones += hit.reward.stones
    if (hit.reward.daoMarks) {
      legacy = { ...legacy, daoMarks: legacy.daoMarks + hit.reward.daoMarks }
    }
    if (hit.reward.title && !titles.includes(hit.reward.title)) {
      titles.push(hit.reward.title)
    }
    log(
      `图鉴「${CODEX_PAGE_META[hit.page].name}」达成 ${hit.pct}%：${describeCodexReward(hit.reward)}`,
      'gold',
    )
  }

  const progressIds = evaluateAchievementIds({
    player: state.player,
    legacy,
    stones,
    gongfaCount: Object.keys(state.gongfa.learned).length,
    treasureCount: state.treasures.length,
    companion: state.companion,
    sect: state.sect,
    towerBest: state.towerBest,
    collection: meta.collection,
    stats,
  })

  const unlockedSet = new Set(achievements)
  for (const id of progressIds) {
    if (unlockedSet.has(id)) continue
    const def = ACHIEVEMENT_MAP[id]
    if (!def) continue
    achievements.push(id)
    unlockedSet.add(id)
    if (def.reward.stones) stones += def.reward.stones
    if (def.reward.daoMarks) {
      legacy = { ...legacy, daoMarks: legacy.daoMarks + def.reward.daoMarks }
    }
    if (def.reward.title && !titles.includes(def.reward.title)) {
      titles.push(def.reward.title)
    }
    log(`成就解锁「${def.name}」：${def.desc} · ${describeAchieveReward(def.reward)}`, 'gold')
  }

  set({
    stones,
    legacy,
    meta: {
      ...meta,
      achievements: uniqIds(achievements),
      codexRewardClaimed: claimed,
      titles,
      stats,
    },
  })
}

/** 触达图鉴/成就的通用入口（战斗获胜、获得物品等之后调用） */
function afterProgressSnapshot(get: MetaGet, set: MetaSet) {
  const state = get()
  if (!state.player) return
  const derived = deriveCollectionFromState(state)
  const collection = mergeCollection(state.meta.collection, derived)
  const stats = {
    ...state.meta.stats,
    stonesPeak: Math.max(state.meta.stats.stonesPeak, state.stones),
  }
  if (
    collection.realm.length !== state.meta.collection.realm.length ||
    collection.gongfa.length !== state.meta.collection.gongfa.length ||
    collection.item.length !== state.meta.collection.item.length ||
    collection.companion.length !== state.meta.collection.companion.length ||
    collection.secret.length !== state.meta.collection.secret.length ||
    stats.stonesPeak !== state.meta.stats.stonesPeak
  ) {
    set({ meta: { ...state.meta, collection, stats } })
  }
  processMetaProgress(get, set)
}

function pickOfflinePill(inventory: Record<string, number>): { id: string; name: string } | null {
  for (const id of OFFLINE_PILL_IDS) {
    if ((inventory[id] ?? 0) > 0) {
      return { id, name: ITEMS[id]?.name ?? id }
    }
  }
  return null
}

function buildOfflinePending(get: MetaGet, settlement: OfflineSettlement): OfflinePending | null {
  const state = get()
  if (!state.player || !settlement.active) return null
  const pill = pickOfflinePill(state.inventory)
  return {
    ...settlement,
    stones: state.stones,
    pillId: pill?.id ?? null,
    pillName: pill?.name ?? '无可用丹药',
  }
}

/** 计算并挂起离线闭关结算（读档/回前台时调用） */
function trySettleOffline(get: MetaGet, set: MetaSet) {
  if (get().offlinePending) return
  const state = get()
  const player = state.player
  if (!player || !player.alive || isAscended(player)) return
  const settlement = calcOfflineCultivation({
    lastOnlineAt: state.meta.lastOnlineAt,
    now: Date.now(),
    classId: player.classId,
    realm: player.realm,
    layer: player.layer,
    multipliers: cultivateMultipliers(
      player,
      state.sect,
      state.companion,
      state.gongfa.learned,
      state.legacy.daoMarks,
    ),
  })
  if (settlement.reason === 'clock_backward') {
    log('检测到时间异常，离线修炼未结算。已重置在线锚点。', 'bad')
    set({ meta: { ...state.meta, lastOnlineAt: Date.now() } })
    return
  }
  if (!settlement.active) return
  const pending = buildOfflinePending(get, settlement)
  if (!pending) return
  set({ offlinePending: pending })
}

function touchOnline(get: MetaGet, set: MetaSet) {
  const meta = get().meta
  set({ meta: { ...meta, lastOnlineAt: Date.now() } })
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
  const st = useGameStore.getState()
  const artifacts = st.artifacts
  const gb = gongfaBonuses(st.gongfa.learned, st.player?.realm)
  const tb = treasureBonus(treasures, artifacts)
  const extras = artifactBattleExtras(artifacts)
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
    atk: Math.floor(base.atk * CLASSES[player.classId].atkMul * tb.atk * gb.atk * (1 + petStatBonus(st.pet).atk) * buildingAtkMul(st.sect.buildings, { isExam: st.activeCombat?.context?.kind === 'sect_exam' })),
    def: Math.floor(base.def * CLASSES[player.classId].defMul * tb.def * gb.def),
    dmgReduce: gb.dodge + extras.dmgReduce,
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
      const meta = get().meta
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
        meta: {
          ...meta,
          stats: { ...meta.stats, combatsWon: meta.stats.combatsWon + 1 },
        },
      })
      unlockCodex(get, set, 'enemy', enemyTemplateId(enemy.id))
      if (result.itemId) unlockCodex(get, set, 'item', result.itemId)
      bumpQuestExploreWin(set)
      afterProgressSnapshot(get, set)
    } else {
      log(`历练遭遇 ${enemy.name}，不敌败退。`, 'bad')
      set({
        time: advanced.time,
        exploring: false,
        activeCombat: null,
        lastCombat: { enemy, win: false, log: lines },
        stones: Math.max(0, get().stones - (get().pet?.job === 'guard' ? Math.floor(15 * (1 - PET_GUARD_LOSS_REDUCE)) : 15)),
        player: {
          ...nextPlayer,
          hp: Math.max(1, result.playerHpLeft > 0 ? hpLeft : Math.floor(player.maxHp * 0.15)),
        },
      })
    }
    const evt = pickEvent()
    if (evt) set({ pendingEvent: { event: evt, kind: 'explore' } })
    maybeTriggerSpouseStory(get, set)
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
      const meta = get().meta
      set({
        inventory: inv,
        stones: get().stones + result.stoneGain,
        activeCombat: null,
        lastCombat: { enemy, win: true, log: lines },
        towerBest: { ...get().towerBest, [realm.id]: best },
        // 通关最后一层：直接退出爬塔，回到秘境列表（避免卡在本层点迎战无响应）
        tower: clearedAll ? null : { ...tower, floor: tower.floor + 1, inCombat: false, log: lines },
        player: {
          ...nextPlayer,
          exp: player.exp + result.expGain,
        },
        meta: {
          ...meta,
          stats: { ...meta.stats, combatsWon: meta.stats.combatsWon + 1 },
        },
      })
      unlockCodex(get, set, 'secret', realm.id)
      // 秘境守卫为动态生成 id；镇守若对应模板则按模板 id 收录
      const templateId = enemyTemplateId(enemy.id)
      if (ENEMY_TEMPLATES.some((t) => t.id === templateId)) {
        unlockCodex(get, set, 'enemy', templateId)
      }
      if (result.itemId) unlockCodex(get, set, 'item', result.itemId)
      bumpQuestExploreWin(set)
      afterProgressSnapshot(get, set)
      if (clearedAll) {
        log(`你贯通了「${realm.name}」全部 ${realm.floors} 层！已退出秘境。`, 'gold')
      }
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
      const metaExam = get().meta
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
        meta: {
          ...metaExam,
          stats: { ...metaExam.stats, combatsWon: metaExam.stats.combatsWon + 1 },
        },
      })
      unlockCodex(get, set, 'enemy', enemyTemplateId(enemy.id))
      afterProgressSnapshot(get, set)
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
  const gb = gongfaBonuses(gongfaLearned, useGameStore.getState().player?.realm)
  const tb = treasureBonus(treasures, useGameStore.getState().artifacts)
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
  const gb = gongfaBonuses(gongfaLearned, useGameStore.getState().player?.realm)
  const tb = treasureBonus(treasures, useGameStore.getState().artifacts)
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

  setPanel: (p: PanelId) => void
  setSkipExploreCombat: (v: boolean) => void
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
  feedPet: () => void
  breakthroughPet: () => void
  setPetJob: (job: PetJob) => void
  releasePet: () => void
  petFarmAssist: () => void
  /** 以 3 张藏经残页参悟一部未习宗门秘法 */
  redeemSectFragment: () => void
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
    artifacts: s.artifacts,
    companion: s.companion,
    gongfa: s.gongfa,
    towerBest: s.towerBest,
    abode: s.abode,
    legacy: s.legacy,
    meta: { ...s.meta, lastOnlineAt: Date.now() },
    pet: s.pet,
    updatedAt: Date.now(),
  }
}

export { gongfaBonuses, treasureBonus, artifactBattleExtras, treasureBreakthroughTotal }

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  time: { year: 1, month: 1, day: 1 },
  player: null,
  stones: 80,
  inventory: defaultInventory(),
  sect: freshSect(),
  treasures: [],
  artifacts: [],
  companion: freshCompanion(),
  gongfa: freshGongfa(),
  towerBest: {},
  tower: null,
  abode: freshAbode(),
  legacy: freshLegacy(),
  meta: freshMeta(),
  pet: null,
  offlinePending: null,
  activePanel: 'cultivate',
  exploring: false,
  lastCombat: null,
  pendingEvent: null,
  pendingStory: null,
  activeCombat: null,
  /** 默认手动，保证战斗面板能先显示；勾选自动后再托管 */
  autoCombat: false,
  skipExploreCombat: loadGameSettings().skipExploreCombat,

  setPanel: (p) => set({ activePanel: p }),
  setSkipExploreCombat: (v) => {
    saveGameSettings({ skipExploreCombat: v })
    set({ skipExploreCombat: v })
    log(
      v
        ? '已开启：历练与秘境将跳过战斗，直接结算战报。'
        : '已关闭：历练与秘境将进入战斗面板手动出招。',
      'dim',
    )
  },
  touchOnline: () => touchOnline(get, set),
  recheckOffline: () => trySettleOffline(get, set),
  resolveOffline: (mode) => {
    const pending = get().offlinePending
    const { player } = get()
    if (!pending || !player || !player.alive) {
      set({ offlinePending: null })
      return
    }
    let gain = pending.expGain
    let stones = get().stones
    let inv = { ...get().inventory }
    if (mode === 'stone') {
      if (stones < pending.deepenStoneCost || pending.deepenStoneExp <= 0) {
        set({ offlinePending: null })
        return
      }
      stones -= pending.deepenStoneCost
      gain += pending.deepenStoneExp
      log(`灵石加深闭关，花费 ${pending.deepenStoneCost}，额外修为 +${pending.deepenStoneExp}`, 'gold')
    } else if (mode === 'pill') {
      const pillId = pending.pillId
      if (!pillId || (inv[pillId] ?? 0) <= 0 || pending.deepenPillExp <= 0) {
        set({ offlinePending: null })
        return
      }
      inv[pillId] = (inv[pillId] ?? 0) - 1
      if (inv[pillId] <= 0) delete inv[pillId]
      gain += pending.deepenPillExp
      log(
        `服下${ITEMS[pillId]?.name ?? pillId}加深闭关，额外修为 +${pending.deepenPillExp}（+${Math.round(OFFLINE_PILL_BONUS * 100)}%）`,
        'gold',
      )
    }

    const need = expNeeded(player.realm, player.layer)
    log(
      `闭关归来：离线约 ${formatOfflineDuration(pending.elapsedMs)}，修为 +${gain}（${player.exp + gain}/${need}）。`,
      'good',
    )
    const meta = get().meta
    set({
      offlinePending: null,
      stones,
      inventory: inv,
      player: { ...player, exp: player.exp + gain },
      meta: {
        ...meta,
        lastOnlineAt: Date.now(),
        stats: {
          ...meta.stats,
          offlineSettled: meta.stats.offlineSettled + 1,
          stonesPeak: Math.max(meta.stats.stonesPeak, stones),
        },
      },
    })
    afterProgressSnapshot(get, set)
  },
  startCreate: () => {
    const { player, companion, legacy } = get()
    // 若此世已终结（飞升优先于道消），先结算道痕再开新身
    if (player && (!player.alive || isAscended(player))) {
      const gain = reincarnateGain(player, Boolean(companion.spouseId))
      const endedYear = get().time.year
      const nextLegacy: LegacyState = {
        daoMarks: legacy.daoMarks + gain.daoMarks,
        reincarnations: legacy.reincarnations + 1,
        bestRealmIndex: Math.max(legacy.bestRealmIndex, realmIndex(player.realm)),
        totalYears: (legacy.totalYears ?? 0) + player.age,
        lastLifeEndYear: endedYear,
        sealed: legacy.sealed ?? [],
      }
      log(`此世终结。结算道痕 +${gain.daoMarks}（${gain.desc}）。`, 'gold')
      log(
        `转生次数 ${nextLegacy.reincarnations}，累计道痕 ${nextLegacy.daoMarks}。` +
          `上一世止于第${endedYear}年（寿龄 ${player.age}）；新一世年号将从第 1 年重新起算。`,
        'gold',
      )
      set({
        legacy: nextLegacy,
        phase: 'create',
        player: null,
        lastCombat: null,
        pendingEvent: null,
        pendingStory: null,
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
        offlinePending: null,
        // meta.collection / achievements 跨周目保留
      })
      afterProgressSnapshot(get, set)
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
      pendingStory: null,
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
      offlinePending: null,
      // 保留道痕与转生次数；图鉴成就同样跨周目保留
    })
  },

  createCharacter: (input) => {
    const legacy = get().legacy
    const player = freshPlayer(input, legacy)
    const dao = daoBonuses(legacy.daoMarks)
    const abode = freshAbode()
    // 初始 6×6=36 格；道痕不再额外送地（开拓另计）
    log(`你名 ${player.name}，踏上修行之路。职业：${CLASSES[player.classId].name}。`, 'gold')
    // v1.0 封印传承物：功法残卷入门带入 / 法宝实例带入
    const learned: Record<string, GongfaLearned> = {}
    const sealedArts: ArtifactInstance[] = []
    const sealedTreasures: string[] = []
    for (const s of legacy.sealed ?? []) {
      if (s.kind === 'gongfa' && GONGFAS[s.id]) {
        if (!learned[s.id]) {
          learned[s.id] = { stage: 0 }
          log(`前世残卷苏醒：《${GONGFAS[s.id].name}》入门（进阶消耗降低）。`, 'gold')
        }
      } else if (s.kind === 'artifact' && s.id) {
        const inst: ArtifactInstance = {
          uid: makeArtifactUid(),
          itemId: s.id,
          name: artifactDisplayName(s.id, s.name),
          quality: s.quality ?? 'mortal',
          affixes: s.affixes ?? [],
          equipped: true,
        }
        sealedArts.push(inst)
        if (s.id.startsWith('treasure_')) sealedTreasures.push(s.id)
        log(`前世法宝渡来：「${inst.name}」。`, 'gold')
      }
    }
    // 同类只出战一件
    const seenArt = new Set<string>()
    for (const a of sealedArts) {
      if (seenArt.has(a.itemId)) a.equipped = false
      else seenArt.add(a.itemId)
    }
    log(`你名 ${player.name}，踏上修行之路。职业：${CLASSES[player.classId].name}。`, 'gold')
    log(`初始寿元 ${player.lifespanLeft} 年。${dayKey(get().time)}，天朗气清。`, 'dim')
    if (legacy.reincarnations > 0) {
      log(
        `此为第 ${legacy.reincarnations} 次转生后的新一世：年号从第 1 年重新起算` +
          `（上一世结束于第${legacy.lastLifeEndYear || '?'}年；历代累计寿龄 ${legacy.totalYears}）。道痕 ${legacy.daoMarks} 继承。`,
        'gold',
      )
    } else if (legacy.daoMarks > 0) {
      log(`道痕 ${legacy.daoMarks}：修炼加速、突破略易，起始灵石更丰。`, 'dim')
    }
    const prevMeta = get().meta
    set({
      phase: 'play',
      player,
      time: { year: 1, month: 1, day: 1 },
      stones: dao.startStones,
      inventory: defaultInventory(),
      sect: freshSect(),
      companion: freshCompanion(),
      gongfa: { learned },
      treasures: sealedTreasures,
      artifacts: sealedArts,
      towerBest: {},
      tower: null,
      abode,
      activePanel: 'cultivate',
      lastCombat: null,
      pendingEvent: null,
      pendingStory: null,
      activeCombat: null,
      exploring: false,
      autoCombat: false,
      offlinePending: null,
      meta: {
        ...prevMeta,
        collection: mergeCollection(prevMeta.collection, { realm: ['qi'] }),
        stats: {
          ...prevMeta.stats,
          stonesPeak: Math.max(prevMeta.stats.stonesPeak, dao.startStones),
        },
        lastOnlineAt: Date.now(),
      },
    })
    if (Object.keys(learned).length > 0) {
      const p2 = recomputeVitals(
        get().player!,
        sealedTreasures,
        learned,
        legacy.daoMarks,
      )
      set({ player: p2 })
    }
    unlockCodex(get, set, 'realm', 'qi')
    processMetaProgress(get, set)
  },

  meditate: () => {
    const { player, time, sect, companion } = get()
    if (!player || !player.alive || isAscended(player) || get().pendingEvent || get().pendingStory || get().tower || get().activeCombat) return
    const sdef = sectDef(sect.sectId)
    const rankBonus = SECT_RANKS[sect.rank].cultivateMul
    const gongfaMul = gongfaBonuses(get().gongfa.learned, get().player?.realm).cultivate * buildingCultivateMul(get().sect.buildings)
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
      touchOnline(get, set)
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
    touchOnline(get, set)

    const evt = pickEvent()
    if (evt) set({ pendingEvent: { event: evt, kind: 'meditate' } })
    maybeTriggerSpouseStory(get, set)
  },

  seclude: (days) => {
    // 与游戏日历对齐：1 年 = 360 日；上限约百年 + 余量
    const n = clamp(days, 1, GAME_DAYS_PER_YEAR * 120)
    const { player, time, sect, companion } = get()
    if (!player || !player.alive || isAscended(player) || get().pendingEvent || get().pendingStory || get().tower || get().activeCombat) return
    const sdef = sectDef(sect.sectId)
    const rankBonus = SECT_RANKS[sect.rank].cultivateMul
    const gongfaMul = gongfaBonuses(get().gongfa.learned, get().player?.realm).cultivate * buildingCultivateMul(get().sect.buildings)
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
      touchOnline(get, set)
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
    touchOnline(get, set)

    const evt = pickEvent()
    if (evt) set({ pendingEvent: { event: evt, kind: 'seclude' } })
    maybeTriggerSpouseStory(get, set)
  },

  breakthrough: (planId = 'normal') => {
    const { player, inventory, sect, companion, treasures } = get()
    if (!player || !player.alive || isAscended(player) || get().pendingEvent || get().pendingStory || get().tower || get().activeCombat) return
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

    const plan = tribulationPlan(planId)
    const planOpen = isTribulationMoment(player.realm, player.layer, def.layers)
    const usedPlan = planOpen ? plan : tribulationPlan('normal')
    let inv = { ...inventory }

    // 方案代价
    if (usedPlan.costItemId) {
      const need = usedPlan.costCount ?? 1
      if ((inv[usedPlan.costItemId] ?? 0) < need) {
        log(`方案「${usedPlan.name}」需「${ITEMS[usedPlan.costItemId]?.name}」×${need}，不足。`, 'bad')
        return
      }
      inv[usedPlan.costItemId] = (inv[usedPlan.costItemId] ?? 0) - need
      if (inv[usedPlan.costItemId] <= 0) delete inv[usedPlan.costItemId]
    }
    if (usedPlan.spouseRisk) {
      const hurtUntil = companion.spouseHurtUntilDay ?? 0
      if (companion.spouseId && hurtUntil > dayNumber(get().time)) {
        log('道侣重伤未愈，无法护法。', 'bad')
        return
      }
      if (!companion.spouseId) {
        log('并无道侣在侧，无法选此方案。', 'bad')
        return
      }
    }

    const sdef = sectDef(sect.sectId)
    const spouse = spouseDef(companion)
    const spouseHurt =
      companion.spouseId && (companion.spouseHurtUntilDay ?? 0) > dayNumber(get().time)
    const spouseBonus = spouse && !spouseHurt ? (spouse.breakthroughBonus ?? 0) : 0
    const dao = daoBonuses(get().legacy.daoMarks)
    const synBt = gongfaBonuses(get().gongfa.learned, get().player?.realm).breakthrough ?? 0
    // 突破法宝（认主常驻，同类不叠加）+ 最佳突破丹药（本次消耗）+ 渡劫令持有
    const treasureBt = treasureBreakthroughTotal(treasures, get().artifacts)
    const breakPill = bestBreakthroughPill(inv)
    // 金丹护道已扣渡劫金丹，不再从自动突破丹里重复扣
    const pillBt =
      usedPlan.id === 'golden_pill' ? 0 : breakPill?.rate ?? 0
    const tribTokenBt = (inv.mat_tribulation ?? 0) > 0 ? 5 : 0
    const rate = Math.min(
      95,
      Math.max(
        5,
        breakthroughRate(player.classId, player.realm) +
          (sdef?.bonus.breakthroughBonus ?? 0) +
          spouseBonus +
          dao.breakthroughBonus +
          treasureBt +
          pillBt +
          tribTokenBt +
          synBt +
          usedPlan.rateDelta +
          currentRules().breakthroughRateDelta,
      ),
    )
    const roll = Math.random() * 100
    // 成败与文案共用「含加成后的 rate」，避免成功却打出失败日志
    const result = attemptBreakthrough(player.classId, player.realm, player.layer, roll, rate)
    const success = result.success
    const need = expNeeded(player.realm, player.layer)

    // 冲击壁垒自动消耗一枚突破丹（无论成败；金丹护道方案除外）
    if (usedPlan.id !== 'golden_pill' && breakPill) {
      inv[breakPill.id] = (inv[breakPill.id] ?? 1) - 1
      if (inv[breakPill.id] <= 0) delete inv[breakPill.id]
    }

    if (success) {
      const next = applyLayerUp(player.realm, player.layer)
      const justAscended = next.realm === 'ascended'
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
      if (usedPlan.id !== 'normal') log(`天劫方案：${usedPlan.name}`, 'gold')
      if (justAscended) {
        log('霞举飞升，超脱此界。此世修行已圆满，可在修炼页选择转生。', 'gold')
      }
      if (spouse && !spouseHurt) log(`${spouse.name}在旁护法，心脉安稳。`, 'dim')
      if (breakPill && usedPlan.id !== 'golden_pill')
        log(`服用「${breakPill.name}」，药力护持破关。`, 'dim')
      if (usedPlan.id === 'golden_pill') log('渡劫金丹化开，雷劫声势为之一缓。', 'dim')
      if (treasureBt > 0) log(`认主法宝加持：突破成功率 +${treasureBt}%`, 'dim')
      if (tribTokenBt > 0) log('渡劫令微光流转，稳住道基。', 'dim')
      if (synBt !== 0) log(`功法羁绊：突破 ${synBt > 0 ? '+' : ''}${synBt}%`, 'dim')
      log(`（成功率约 ${Math.round(rate)}%）`, 'dim')
      let extraDao = usedPlan.extraDao ?? 0
      let legacyNext = get().legacy
      if (extraDao > 0) {
        legacyNext = { ...legacyNext, daoMarks: legacyNext.daoMarks + extraDao }
        log(`强冲天机，额外道痕 +${extraDao}。`, 'gold')
      }
      set({
        inventory: inv,
        legacy: legacyNext,
        player: {
          ...vitals,
          realm: next.realm,
          layer: next.layer,
          exp: justAscended ? 0 : Math.max(0, player.exp - need),
          hp: vitals.maxHp,
          energy: vitals.maxEnergy,
          // 飞升写入终局标志，避免继续老化/战斗后被误判为道消
          ascended: justAscended ? true : vitals.ascended,
          alive: justAscended ? true : vitals.alive,
          lifespanLeft: justAscended
            ? Math.floor(REALMS.ascended.lifespan * currentRules().lifespanMul)
            : Math.max(
                player.lifespanLeft,
                Math.floor(REALMS[next.realm].lifespan * currentRules().lifespanMul),
              ),
        },
      })
      unlockCodex(get, set, 'realm', next.realm)
      afterProgressSnapshot(get, set)
      return
    }

    // 失败惩罚：severity 已按最终 rate 判定；天劫方案可降档
    let severity = result.severity
    if (usedPlan.softenFail) severity = softenSeverity(severity)

    if (usedPlan.spouseRisk && spouse) {
      const until = dayNumber(get().time) + 7
      set({
        companion: { ...get().companion, spouseHurtUntilDay: until },
      })
      log(`${spouse.name}护法被雷劫余波所伤，七日内无法助战/代劳。`, 'bad')
    }

    log(result.message, 'bad')
    if (usedPlan.id !== 'normal') log(`天劫方案：${usedPlan.name}`, 'dim')
    if (breakPill && usedPlan.id !== 'golden_pill')
      log(`服用「${breakPill.name}」，药力仍未能扭转乾坤。`, 'dim')
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
    // 残留的已结束战斗先清掉，避免按钮被 activeCombat 卡死
    const ac = get().activeCombat
    if (ac && ac.finished) {
      set({ activeCombat: null, exploring: false })
    }
    if (!player || !player.alive) {
      log('此身已无法再踏入山野。', 'bad')
      return
    }
    if (isAscended(player)) {
      log('你已飞升，不再入世历练。', 'dim')
      return
    }
    if (get().pendingEvent || get().pendingStory) {
      log('尚有奇遇未了结，请先处理当前事件。', 'bad')
      return
    }
    if (get().tower) {
      log('你正在秘境之中，请先撤离或继续闯关。', 'bad')
      return
    }
    const combat = get().activeCombat
    if (combat && !combat.finished) {
      log('战斗进行中，无法出门历练。', 'bad')
      return
    }
    if (get().exploring) {
      log('正在激斗中……', 'dim')
      return
    }
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
    // 设置开启时：同步打完并结算，不进入交互战斗面板
    if (get().skipExploreCombat) {
      get().runCombatAutoToEnd()
    }
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
    if (!player || !player.alive || isAscended(player)) return
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
    set({ inventory: inv, abode: { ...abode, plots } })
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
    set({ inventory: inv, abode: { ...abode, plots } })
  },

  plantAll: (seedId) => {
    const { abode, inventory, player, time } = get()
    if (!player || !player.alive || isAscended(player)) return
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
    set({ inventory: inv, abode: { ...abode, plots } })
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
    set({ inventory: inv, abode: { ...abode, plots } })
  },

  expandFarmCol: () => {
    const { abode, stones, player } = get()
    if (!player || !player.alive) return
    if (!canExpandFarmCols(abode.farmCols)) {
      log('灵田横向已开拓至极限。', 'dim')
      return
    }
    const cost = expandColCost(abode.farmCols)
    if (stones < cost) {
      log(`开拓一列灵田需灵石 ${cost}。`, 'bad')
      return
    }
    const newCols = abode.farmCols + 1
    const plots = remapFarmPlots(
      abode.plots,
      abode.farmCols,
      abode.farmRows,
      newCols,
      abode.farmRows,
    )
    log(
      `向右开拓荒地，灵田扩为 ${newCols}×${abode.farmRows}（${plots.length} 格），花费灵石 ${cost}。`,
      'gold',
    )
    set({
      stones: stones - cost,
      abode: { ...abode, farmCols: newCols, plots },
    })
  },

  expandFarmRow: () => {
    const { abode, stones, player } = get()
    if (!player || !player.alive) return
    if (!canExpandFarmRows(abode.farmRows)) {
      log('灵田纵向已开拓至极限。', 'dim')
      return
    }
    const cost = expandRowCost(abode.farmRows)
    if (stones < cost) {
      log(`开拓一行灵田需灵石 ${cost}。`, 'bad')
      return
    }
    const newRows = abode.farmRows + 1
    const plots = remapFarmPlots(
      abode.plots,
      abode.farmCols,
      abode.farmRows,
      abode.farmCols,
      newRows,
    )
    log(
      `向前开拓荒地，灵田扩为 ${abode.farmCols}×${newRows}（${plots.length} 格），花费灵石 ${cost}。`,
      'gold',
    )
    set({
      stones: stones - cost,
      abode: { ...abode, farmRows: newRows, plots },
    })
  },

  craftItem: (recipeId) => {
    const { player, inventory, time } = get()
    if (!player || !player.alive || isAscended(player)) return
    const recipe = RECIPES[recipeId]
    if (!recipe) return
    if (!canCraft(recipe, inventory)) {
      log('药材不足。', 'bad')
      return
    }
    const rate = Math.min(98, craftRate(recipe, player.classId, get().legacy.daoMarks) + buildingCraftRateBonus(get().sect.buildings))
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
      const metaCraft = get().meta
      set({
        time: advanced.time,
        inventory: inv,
        player: { ...player, age: aged, lifespanLeft: life },
        meta: {
          ...metaCraft,
          stats: { ...metaCraft.stats, pillsCrafted: metaCraft.stats.pillsCrafted + 1 },
        },
      })
      unlockCodex(get, set, 'item', recipe.outputItemId)
      afterProgressSnapshot(get, set)
      return
    } else {
      log('炉火失控，药材尽废……', 'bad')
    }
    set({
      time: advanced.time,
      inventory: inv,
      player: { ...player, age: aged, lifespanLeft: life },
    })
  },

  upgradeForge: () => {
    const { player, abode, stones, time } = get()
    if (!player || !player.alive || isAscended(player)) return
    const lv = abode.forgeLevel ?? 0
    const def = forgeLevelDef(lv)
    const next = forgeLevelDef(lv + 1)
    if (lv >= 3) {
      log('器阁已是天工，无可复加。', 'dim')
      return
    }
    if (stones < def.upgradeCost) {
      log(`升级器阁需灵石 ${def.upgradeCost}。`, 'bad')
      return
    }
    const days = lv === 0 ? 2 : def.upgradeDays || 2
    const advanced = advanceTime(time, days)
    const aged = player.age + advanced.agedYears
    const life = player.lifespanLeft - advanced.agedYears
    if (life <= 0) {
      set({
        time: advanced.time,
        stones: stones - def.upgradeCost,
        player: { ...player, age: aged, lifespanLeft: 0, alive: false },
      })
      log('督造器阁操劳过度，寿元耗尽……', 'bad')
      return
    }
    const level = Math.min(3, lv + 1)
    set({
      time: advanced.time,
      stones: stones - def.upgradeCost,
      abode: { ...abode, forgeLevel: level },
      player: { ...player, age: aged, lifespanLeft: life },
    })
    log(`器阁升至 ${forgeLevelDef(level).name}（${next.name}）。可出品质上限：${forgeLevelDef(level).qualityCap}。`, 'gold')
  },

  forgeArtifact: (recipeId) => {
    const { player, inventory, stones, abode, time, treasures, artifacts } = get()
    if (!player || !player.alive || isAscended(player)) return
    const forgeLevel = abode.forgeLevel ?? 0
    const chk = canForge({
      recipeId,
      inventory,
      stones,
      forgeLevel,
    })
    if (!chk.ok) {
      log(chk.reason ?? '无法打造。', 'bad')
      return
    }
    const outcome = performCraft({
      recipeId,
      classId: player.classId,
      daoMarks: get().legacy.daoMarks,
      forgeLevel,
    })
    const paid = consumeForgeMaterials(inventory, recipeId, stones)
    const craftDays = ARTIFACT_CRAFT_DAYS(recipeId)
    const advanced = advanceTime(time, craftDays)
    const aged = player.age + advanced.agedYears
    const life = player.lifespanLeft - advanced.agedYears
    if (life <= 0) {
      set({
        time: advanced.time,
        inventory: paid.inventory,
        stones: paid.stones,
        player: { ...player, age: aged, lifespanLeft: 0, alive: false },
      })
      log('炼器耗神，寿元耗尽……', 'bad')
      return
    }
    if (!outcome.ok || !outcome.instance) {
      set({
        time: advanced.time,
        inventory: paid.inventory,
        stones: paid.stones,
        player: { ...player, age: aged, lifespanLeft: life },
      })
      log(outcome.message, 'bad')
      return
    }
    let inst = outcome.instance
    // 无同类出战则自动认主
    const hasActive = treasures.includes(inst.itemId)
    if (!hasActive) {
      inst = { ...inst, equipped: true }
    }
    const nextArts = [...artifacts, inst]
    const nextTreasures = inst.equipped ? [...treasures, inst.itemId] : treasures
    set({
      time: advanced.time,
      inventory: paid.inventory,
      stones: paid.stones,
      artifacts: nextArts,
      treasures: nextTreasures,
      player: {
        ...recomputeVitals(
          { ...player, age: aged, lifespanLeft: life },
          nextTreasures,
          get().gongfa.learned,
          get().legacy.daoMarks,
        ),
      },
    })
    log(outcome.message, 'gold')
    if (inst.affixes.length > 0) {
      log(`词条：${inst.affixes.map((a) => describeAffix(a)).join('、')}`, 'gold')
    }
    unlockCodex(get, set, 'item', inst.itemId)
    afterProgressSnapshot(get, set)
  },

  refineArtifact: (uid) => {
    const { player, artifacts, inventory, stones } = get()
    if (!player || !player.alive || isAscended(player)) return
    const art = artifacts.find((a) => a.uid === uid)
    if (!art) return
    const cost = refineCost(art.quality)
    if (stones < cost.stones) {
      log(`洗练需灵石 ${cost.stones}。`, 'bad')
      return
    }
    if (cost.mat && cost.matCount) {
      if ((inventory[cost.mat] ?? 0) < cost.matCount) {
        log(`洗练还需「${ITEMS[cost.mat]?.name ?? cost.mat}」×${cost.matCount}。`, 'bad')
        return
      }
    }
    const inv = { ...inventory }
    if (cost.mat && cost.matCount) {
      inv[cost.mat] = (inv[cost.mat] ?? 0) - (cost.matCount ?? 0)
      if ((inv[cost.mat] ?? 0) <= 0) delete inv[cost.mat]
    }
    const forgeLevel = get().abode.forgeLevel ?? 0
    const qualityCap = forgeLevelDef(forgeLevel).qualityCap
    let nextQuality: ArtifactQuality = art.quality
    if (art.quality === 'mortal') {
      nextQuality = qualityCap === 'mortal' ? 'spirit' : qualityCap
    }
    const nextArts = artifacts.map((a) =>
      a.uid === uid
        ? {
            ...a,
            quality: nextQuality,
            name: a.name || ITEMS[a.itemId]?.name || a.itemId,
            affixes:
              nextQuality === 'mortal' ? [] : rollAffixIds(nextQuality, qualityCap).map((id) => ({ id })),
          }
        : a,
    )
    set({
      inventory: inv,
      stones: stones - cost.stones,
      artifacts: nextArts,
    })
    log(`洗练「${artifactDisplayName(art.itemId, art.name)}」：${describeArtifact(nextArts.find((x) => x.uid === uid)!)}`, 'gold')
  },

  equipArtifact: (uid) => {
    const { artifacts, treasures, player } = get()
    if (!player) return
    const art = artifacts.find((a) => a.uid === uid)
    if (!art) return
    const nextArts = artifacts.map((a) => {
      if (a.uid === uid) return { ...a, equipped: true }
      if (a.itemId === art.itemId) return { ...a, equipped: false }
      return a
    })
    const nextTreasures = Array.from(
      new Set(nextArts.filter((a) => a.equipped).map((a) => a.itemId)),
    )
    // 保留旧认主列表中不在 artifacts 的 id（坊市直购等）
    for (const id of treasures) {
      if (!nextArts.some((a) => a.itemId === id) && !nextTreasures.includes(id)) {
        nextTreasures.push(id)
      }
    }
    set({
      artifacts: nextArts,
      treasures: nextTreasures,
      player: recomputeVitals(player, nextTreasures, get().gongfa.learned, get().legacy.daoMarks),
    })
    log(`「${artifactDisplayName(art.itemId, art.name)}」已认主出战（同类仅一件生效）。`, 'dim')
  },

  decomposeArtifact: (uid) => {
    const { artifacts, inventory, player, treasures } = get()
    const art = artifacts.find((a) => a.uid === uid)
    if (!art) return
    const inv = { ...inventory }
    for (const y of decomposeYield(art.quality)) {
      inv[y.itemId] = (inv[y.itemId] ?? 0) + y.count
    }
    const nextArts = artifacts.filter((a) => a.uid !== uid)
    const nextTreasures = art.equipped
      ? Array.from(
          new Set([
            ...nextArts.filter((a) => a.equipped).map((a) => a.itemId),
            ...treasures.filter((id) => id !== art.itemId || nextArts.some((a) => a.equipped && a.itemId === id)),
          ]),
        )
      : treasures
    set({
      artifacts: nextArts,
      inventory: inv,
      treasures: nextTreasures,
      player: player
        ? recomputeVitals(player, nextTreasures, get().gongfa.learned, get().legacy.daoMarks)
        : player,
    })
    const yieldText = decomposeYield(art.quality)
      .map((y) => `${ITEMS[y.itemId]?.name ?? y.itemId}×${y.count}`)
      .join('、')
    log(`分解「${artifactDisplayName(art.itemId, art.name)}」，获得 ${yieldText}。`, 'dim')
  },

  reincarnate: (input, sealed = null) => {
    const { player, companion, legacy } = get()
    if (!player || (player.alive && !isAscended(player))) {
      log('此身尚在修行，无需转生。（需先飞升或道消）', 'dim')
      return
    }
    const gain = reincarnateGain(player, Boolean(companion.spouseId))
    let extraDaoCost = 0
    const nextSealed: SealedItem[] = [...(legacy.sealed ?? [])]
    const slots = sealSlots(legacy.daoMarks + gain.daoMarks)
    if (sealed) {
      if (nextSealed.length >= slots) {
        log('封印槽不足，无法带走传承物。', 'bad')
        return
      }
      extraDaoCost = sealed.daoCost ?? (sealed.kind === 'artifact' ? sealDaoCost(sealed.quality) : 0)
      if (gain.daoMarks + legacy.daoMarks < extraDaoCost) {
        log(`封印此物需额外道痕 ${extraDaoCost}，此世道痕不足。`, 'bad')
        return
      }
      nextSealed.push({
        ...sealed,
        daoCost: extraDaoCost,
      })
    }
    const netDao = Math.max(0, gain.daoMarks - extraDaoCost)
    const endedYear = get().time.year
    const nextLegacy: LegacyState = {
      daoMarks: legacy.daoMarks + netDao,
      reincarnations: legacy.reincarnations + 1,
      bestRealmIndex: Math.max(legacy.bestRealmIndex, realmIndex(player.realm)),
      totalYears: (legacy.totalYears ?? 0) + player.age,
      lastLifeEndYear: endedYear,
      sealed: nextSealed,
    }
    log(`此世终结。结算道痕 +${netDao}（${gain.desc}${extraDaoCost ? ` · 封印代价 -${extraDaoCost}` : ''}）。`, 'gold')
    if (sealed) {
      log(`封印传承物：「${sealed.name}」，将于下一世苏醒。`, 'gold')
    }
    log(
      `转生次数 ${nextLegacy.reincarnations}，累计道痕 ${nextLegacy.daoMarks}。` +
        `上一世止于第${endedYear}年（寿龄 ${player.age}）；新一世年号从第 1 年起算，不沿用前世。`,
      'gold',
    )
    set({ legacy: nextLegacy })
    get().createCharacter(input)
  },

  resolveEvent: (actionId) => {
    const { pendingEvent, player, inventory, stones, treasures, sect, companion, legacy } = get()
    if (!pendingEvent || !player || !player.alive) {
      set({ pendingEvent: null })
      return
    }
    const evt = pendingEvent.event
    let inv = { ...inventory }
    const action: WorldEventAction | undefined = evt.actions.find((a) => a.id === actionId)

    // 支付行动代价
    if (action?.cost) {
      const c = action.cost
      if (c.stones && stones < c.stones) {
        log('灵石不足，无法如此行事。', 'bad')
        return
      }
      if (c.contribution && sect.contribution < c.contribution) {
        log('宗门贡献不足。', 'bad')
        return
      }
      if (c.items) {
        for (const [id, n] of Object.entries(c.items)) {
          if ((inv[id] ?? 0) < n) {
            log(`「${ITEMS[id]?.name ?? id}」不足。`, 'bad')
            return
          }
        }
        for (const [id, n] of Object.entries(c.items)) {
          inv[id] = (inv[id] ?? 0) - n
          if (inv[id] <= 0) delete inv[id]
        }
      }
    }

    const applySettleOutcome = (oc: EventOutcome | undefined, fallbackText: string) => {
      let p = { ...player }
      let st = stones - (action?.cost?.stones ?? 0) + (oc?.stones ?? 0)
      let contrib = sect.contribution - (action?.cost?.contribution ?? 0) + (oc?.contribution ?? 0)
      let pool = sect.pool + (oc?.pool ?? 0)
      let flags = [...companion.flags]
      let hidden = [...companion.hiddenUnlocked]
      let nextInv = { ...inv }
      if (oc?.itemId) {
        nextInv[oc.itemId] = (nextInv[oc.itemId] ?? 0) + 1
      }
      if (oc?.exp) p.exp += oc.exp
      if (oc?.repRight) p.repRight += oc.repRight
      if (oc?.repDemonic) p.repDemonic += oc.repDemonic
      if (oc?.lifespan) p.lifespanLeft = Math.max(1, p.lifespanLeft - oc.lifespan)
      if (oc?.hpPct) p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * oc.hpPct))
      let legacyNext = legacy
      if (oc?.daoMarks) {
        legacyNext = { ...legacy, daoMarks: legacy.daoMarks + oc.daoMarks }
      }
      if (oc?.flag && !flags.includes(oc.flag)) flags.push(oc.flag)
      if (oc?.kind === 'unlock_companion' && oc.companionId) {
        if (!hidden.includes(oc.companionId)) hidden.push(oc.companionId)
        // 初见好感
        companion.affinity[oc.companionId] = Math.max(companion.affinity[oc.companionId] ?? 0, 30)
      }
      log(oc?.text ?? fallbackText, oc?.kind === 'unlock_companion' ? 'gold' : 'info')
      set({
        pendingEvent: null,
        inventory: nextInv,
        stones: Math.max(0, st),
        legacy: legacyNext,
        sect: { ...sect, contribution: Math.max(0, contrib), pool: Math.max(0, pool) },
        companion: {
          ...companion,
          flags: uniqIds(flags),
          hiddenUnlocked: uniqIds(hidden),
          affinity: { ...companion.affinity },
        },
        player: p,
      })
      if (oc?.itemId) unlockCodex(get, set, 'item', oc.itemId)
      if (oc?.kind === 'unlock_companion' && oc.companionId) {
        unlockCodex(get, set, 'companion', oc.companionId)
      }
      afterProgressSnapshot(get, set)
    }

    const runEventCombat = (bossId: string, win?: EventOutcome, lose?: EventOutcome) => {
      const enemy = ENEMIES.find((e) => e.id === bossId) ?? ENEMIES[0]
      const actor = makePlayerCombatant(player, treasures, 1)
      const label = '奇遇战斗'
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
      // 先扣行动代价中的灵石/贡献
      const costStones = action?.cost?.stones ?? 0
      const costContrib = action?.cost?.contribution ?? 0
      if (result.win) {
        const dropId = enemy.loot.itemId
        if (dropId && Math.random() < (enemy.loot.dropRate ?? 0.6)) {
          inv[dropId] = (inv[dropId] ?? 0) + 1
        }
        const rep = repDeltaOnKill(enemy)
        log(`${label}获胜：${enemy.name}`, 'gold')
        const extra = win
        if (extra?.text) log(extra.text, 'gold')
        const metaEvt = get().meta
        let flags = [...get().companion.flags]
        if (extra?.flag && !flags.includes(extra.flag)) flags.push(extra.flag)
        const nextInv = { ...inv }
        if (extra?.itemId) nextInv[extra.itemId] = (nextInv[extra.itemId] ?? 0) + 1
        const stonesGain =
          result.stoneGain - costStones + (extra?.stones ?? 0)
        const contribGain =
          sect.contribution - costContrib + (extra?.contribution ?? 0) + 0
        let legacyNext = legacy
        if (extra?.daoMarks) {
          legacyNext = { ...legacy, daoMarks: legacy.daoMarks + extra.daoMarks }
        }
        set({
          pendingEvent: null,
          inventory: nextInv,
          stones: Math.max(0, get().stones + stonesGain),
          legacy: legacyNext,
          sect: { ...sect, contribution: Math.max(0, contribGain) },
          companion: { ...get().companion, flags: uniqIds(flags) },
          lastCombat: { enemy, win: true, log: lines },
          player: {
            ...player,
            exp: player.exp + result.expGain + (extra?.exp ?? 0),
            hp: Math.max(1, result.playerHpLeft),
            energy: result.playerEnergyLeft,
            lifespanLeft: Math.max(
              1,
              player.lifespanLeft - result.lifespanCost - (extra?.lifespan ?? 0),
            ),
            repRight: player.repRight + rep.right + (extra?.repRight ?? 0),
            repDemonic: player.repDemonic + rep.demonic + (extra?.repDemonic ?? 0),
          },
          meta: {
            ...metaEvt,
            stats: { ...metaEvt.stats, combatsWon: metaEvt.stats.combatsWon + 1 },
          },
        })
        unlockCodex(get, set, 'enemy', enemyTemplateId(enemy.id))
        if (dropId) unlockCodex(get, set, 'item', dropId)
        if (extra?.itemId) unlockCodex(get, set, 'item', extra.itemId)
        afterProgressSnapshot(get, set)
      } else {
        log(`${label}失败：${enemy.name}`, 'bad')
        const extra = lose
        if (extra?.text) log(extra.text, 'bad')
        let flags = [...get().companion.flags]
        if (extra?.flag && !flags.includes(extra.flag)) flags.push(extra.flag)
        const nextInv = { ...inv }
        if (extra?.itemId) nextInv[extra.itemId] = (nextInv[extra.itemId] ?? 0) + 1
        let legacyNext = legacy
        if (extra?.daoMarks) {
          legacyNext = { ...legacy, daoMarks: legacy.daoMarks + extra.daoMarks }
        }
        const hpFloor = extra?.hpPct
          ? Math.max(1, player.hp - Math.floor(player.maxHp * extra.hpPct))
          : Math.max(1, Math.floor(player.maxHp * 0.15))
        set({
          pendingEvent: null,
          inventory: nextInv,
          lastCombat: { enemy, win: false, log: lines },
          legacy: legacyNext,
          stones: Math.max(0, get().stones - 20 - costStones + (extra?.stones ?? 0)),
          sect: {
            ...sect,
            contribution: Math.max(0, sect.contribution - costContrib + (extra?.contribution ?? 0)),
          },
          companion: { ...get().companion, flags: uniqIds(flags) },
          player: {
            ...player,
            exp: player.exp + (extra?.exp ?? 0),
            hp: hpFloor,
            energy: result.playerEnergyLeft,
            lifespanLeft: Math.max(
              1,
              player.lifespanLeft - result.lifespanCost - (extra?.lifespan ?? 0),
            ),
            repRight: player.repRight + (extra?.repRight ?? 0),
            repDemonic: player.repDemonic + (extra?.repDemonic ?? 0),
          },
        })
        if (extra?.itemId) unlockCodex(get, set, 'item', extra.itemId)
      }
    }

    // v0.9：带 outcome 的新动作
    if (action?.outcome) {
      const oc = action.outcome
      if (oc.kind === 'combat') {
        runEventCombat(oc.bossId ?? evt.payload?.bossId ?? 'boss_tiger', oc.win, oc.lose)
        return
      }
      if (oc.kind === 'unlock_companion') {
        applySettleOutcome(oc, '缘分已至。')
        return
      }
      applySettleOutcome(oc, `你选择：${action.label}`)
      return
    }

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
        unlockCodex(get, set, 'item', evt.payload.itemId)
        afterProgressSnapshot(get, set)
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
      runEventCombat(
        evt.payload?.bossId ??
          (evt.id.includes('ice') ? 'boss_ape' : evt.id.includes('demon') ? 'boss_demon_lord' : 'boss_tiger'),
      )
      return
    }

    set({ pendingEvent: null })
  },

  resolveStory: (choiceId) => {
    const { pendingStory, companion, player, stones, legacy, inventory } = get()
    if (!pendingStory || !player) {
      set({ pendingStory: null })
      return
    }
    const { companionId, beat } = pendingStory
    const choice: StoryChoice | undefined = beat.choices?.find((c) => c.id === choiceId)
    const stage = companion.postStage[companionId] ?? 0
    const nextStage = stage + 1
    const aff = companion.affinity[companionId] ?? 0

    log(`【${beat.title}】${beat.text}`, 'gold')
    if (choice) {
      log(choice.text, choice.ending === 'be' ? 'bad' : choice.ending === 'he' ? 'gold' : 'info')
    } else if (beat.postText) {
      log(beat.postText, 'info')
    }

    let nextAff = aff + (choice?.affinity ?? 0)
    let nextStones = stones + (choice?.stones ?? 0)
    let nextInv = { ...inventory }
    if (choice?.itemId) nextInv[choice.itemId] = (nextInv[choice.itemId] ?? 0) + 1
    let p = { ...player }
    if (choice?.exp) p.exp += choice.exp
    if (choice?.repRight) p.repRight += choice.repRight
    if (choice?.repDemonic) p.repDemonic += choice.repDemonic
    if (choice?.hpPct) p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * choice.hpPct))
    let legacyNext = legacy
    if (choice?.daoMarksCost) {
      if (legacy.daoMarks < choice.daoMarksCost) {
        log('道痕不足，无法强改天机。请另作抉择。', 'bad')
        return
      }
      legacyNext = { ...legacy, daoMarks: legacy.daoMarks - choice.daoMarksCost }
    }

    const endings = { ...companion.endings }
    const flags = [...companion.flags]
    const ending = choice?.ending ?? beat.ending ?? null
    if (ending) {
      endings[storyEndingKey(companionId, ending)] = ending
    }
    if (choice?.flag && !flags.includes(choice.flag)) flags.push(choice.flag)

    // BE 结局后不再推进后续段
    const storyLen = companionById(companionId)?.postStory?.length ?? nextStage
    const advancedStage = ending === 'be' ? storyLen : nextStage

    set({
      pendingStory: null,
      stones: Math.max(0, nextStones),
      inventory: nextInv,
      legacy: legacyNext,
      companion: {
        ...companion,
        affinity: { ...companion.affinity, [companionId]: Math.max(0, nextAff) },
        postStage: { ...companion.postStage, [companionId]: advancedStage },
        endings,
        flags: uniqIds(flags),
      },
      player: p,
    })
    if (ending) {
      unlockCodex(get, set, 'companion', storyEndingKey(companionId, ending))
    }
    afterProgressSnapshot(get, set)
  },

  triggerSpouseStory: () => {
    maybeTriggerSpouseStory(get, set)
    if (!get().pendingStory) {
      log('眼下无新的缘法可续。', 'dim')
    }
  },

  spouseFarmHelp: () => {
    const { companion, player, time, abode, inventory } = get()
    if (!player || !player.alive || !companion.spouseId) return
    if ((companion.spouseHurtUntilDay ?? 0) > dayNumber(time)) {
      log('道侣重伤未愈，无法代劳。', 'bad')
      return
    }
    const key = `${time.year}-${time.month}-${time.day}`
    if (companion.farmHelpOn === key) {
      log('今日道侣已代为打理过灵田。', 'dim')
      return
    }
    const c = companionById(companion.spouseId)
    if (!c) return
    let inv = { ...inventory }
    let harvested = 0
    const plots = abode.plots.map((plot) => {
      const prog = plotProgress(plot, time)
      if (!plot.seedId || !prog.ready) return plot
      const seed = SEEDS[plot.seedId]
      if (!seed) return { seedId: null, plantedDay: 0 }
      const n = harvestYield(plot.seedId) + 1 + Math.floor(Math.random() * 2)
      inv[seed.yieldItemId] = (inv[seed.yieldItemId] ?? 0) + n
      harvested += n
      return { seedId: null, plantedDay: 0 }
    })
    // 自动补种
    let replanted = 0
    const finalPlots = plots.map((plot) => {
      if (plot.seedId) return plot
      for (const s of SEED_LIST) {
        if ((inv[s.id] ?? 0) > 0) {
          inv[s.id] -= 1
          if (inv[s.id] <= 0) delete inv[s.id]
          replanted += 1
          return { seedId: s.id, plantedDay: dayNumber(time) }
        }
      }
      return plot
    })
    log(
      `${c.name}代你打理灵田：收获 ${harvested} 份${replanted ? `，补种 ${replanted} 块` : ''}。`,
      'good',
    )
    set({
      inventory: inv,
      abode: { ...abode, plots: finalPlots },
      companion: { ...companion, farmHelpOn: key },
    })
  },

  spousePillHelp: () => {
    const { companion, player, time, inventory } = get()
    if (!player || !player.alive || !companion.spouseId) return
    if ((companion.spouseHurtUntilDay ?? 0) > dayNumber(time)) {
      log('道侣重伤未愈，无法代炼。', 'bad')
      return
    }
    const key = `${time.year}-${time.month}-${time.day}`
    if (companion.pillHelpOn === key) {
      log('今日道侣已代炼过丹药。', 'dim')
      return
    }
    const c = companionById(companion.spouseId)
    if (!c) return
    const inv = { ...inventory }
    // 苏青/玄灵炼丹更佳
    const skilled = c.id === 'su_qing' || c.id === 'xuan_ling'
    const healN = skilled ? 2 : 1
    const qiN = skilled ? 1 : 0
    inv.pill_heal = (inv.pill_heal ?? 0) + healN
    if (qiN) inv.pill_qi = (inv.pill_qi ?? 0) + qiN
    log(
      `${c.name}代炼低阶丹药：回春散 ×${healN}${qiN ? `，聚气丹 ×${qiN}` : ''}。`,
      'good',
    )
    set({
      inventory: inv,
      companion: { ...companion, pillHelpOn: key },
    })
    unlockCodex(get, set, 'item', 'pill_heal')
    afterProgressSnapshot(get, set)
  },

  acceptQuestChain: (chainId) => {
    const { sect, player } = get()
    if (!player || !sect.sectId) return
    if (sect.quest) {
      log('已有任务在身，可先完成或放弃。', 'dim')
      return
    }
    const chain = questChainById(chainId)
    if (!chain) return
    const cur = SECTS.find((s) => s.id === sect.sectId)
    const align = cur?.alignment ?? 'righteous'
    const open = availableQuestChains(sect.rank, player.realm, align)
    if (!open.some((c) => c.id === chainId)) {
      log('当前职位/境界尚不可接取此任务链。', 'bad')
      return
    }
    log(`接取宗门任务链「${chain.name}」：${chain.brief}`, 'gold')
    set({
      sect: {
        ...sect,
        quest: { chainId, stepIndex: 0, progress: 0, completedSteps: 0 },
      },
    })
  },

  advanceQuestStep: () => {
    const { sect, player, time, inventory, stones } = get()
    if (!player || !sect.sectId || !sect.quest) return
    if (get().activeCombat && !get().activeCombat!.finished) {
      log('战斗进行中，无法处理任务链。', 'bad')
      return
    }
    const chain = questChainById(sect.quest.chainId)
    if (!chain) return
    const step = chain.steps[sect.quest.stepIndex]
    if (!step) {
      // 全部完成，结算
      const r = chain.reward
      const rankMul = SECT_RANKS[sect.rank].taskMul
      const gain = Math.floor(r.contribution * rankMul)
      const poolCut = commissionPoolCutOf(gain)
      let inv = { ...inventory }
      let gotFragment = false
      if (r.fragmentChance && Math.random() < r.fragmentChance) {
        inv.sect_fragment = (inv.sect_fragment ?? 0) + 1
        gotFragment = true
      }
      log(`任务链「${chain.name}」完成！贡献 +${gain}，灵石 +${r.stone ?? 0}${poolCut ? '，池 +' + poolCut : ''}`, 'gold')
      if (gotFragment) log('宗门额外赐下「藏经残页」×1。', 'gold')
      if (r.exp) log(`修为 +${r.exp}`, 'good')
      set({
        inventory: inv,
        stones: stones + (r.stone ?? 0),
        sect: {
          ...sect,
          contribution: sect.contribution + gain,
          pool: sect.pool + poolCut,
          quest: null,
          questsDone: sect.questsDone + 1,
        },
        player: { ...player, exp: player.exp + (r.exp ?? 0) },
      })
      if (gotFragment) unlockCodex(get, set, 'item', 'sect_fragment')
      afterProgressSnapshot(get, set)
      return
    }

    if (step.type === 'explore_win') {
      log('此步需在历练/秘境中获胜，外出时自动计入进度。', 'dim')
      return
    }

    if (step.type === 'deliver') {
      const need = step.count ?? 1
      const match = questStepMatchesDeliver(step, inventory)
      if (!match.ok || !match.itemId) {
        log(`材料不足：${step.desc}`, 'bad')
        return
      }
      const inv = { ...inventory }
      inv[match.itemId] = (inv[match.itemId] ?? 0) - need
      if (inv[match.itemId] <= 0) delete inv[match.itemId]
      log(`任务链「${chain.name}」：交付完成（${step.desc}）。`, 'good')
      set({
        inventory: inv,
        sect: {
          ...sect,
          quest: {
            ...sect.quest,
            stepIndex: sect.quest.stepIndex + 1,
            progress: 0,
            completedSteps: sect.quest.completedSteps + 1,
          },
        },
      })
      return
    }

    if (step.type === 'stones') {
      const cost = step.stones ?? 0
      if (stones < cost) {
        log(`灵石不足 ${cost}。`, 'bad')
        return
      }
      log(`任务链「${chain.name}」：拨付灵石 ${cost}。`, 'good')
      set({
        stones: stones - cost,
        sect: {
          ...sect,
          quest: {
            ...sect.quest,
            stepIndex: sect.quest.stepIndex + 1,
            progress: 0,
            completedSteps: sect.quest.completedSteps + 1,
          },
        },
      })
      return
    }

    if (step.type === 'report') {
      const advanced = advanceTime(time, 1)
      log(`任务链「${chain.name}」：${step.desc}`, 'good')
      set({
        time: advanced.time,
        sect: {
          ...sect,
          quest: {
            ...sect.quest,
            stepIndex: sect.quest.stepIndex + 1,
            progress: 0,
            completedSteps: sect.quest.completedSteps + 1,
          },
        },
        player: {
          ...player,
          age: player.age + advanced.agedYears,
          lifespanLeft: player.lifespanLeft - advanced.agedYears,
        },
      })
      // 若已是最后一步，下一次 advance 会结算
      const nextStep = chain.steps[sect.quest.stepIndex + 1]
      if (!nextStep) {
        get().advanceQuestStep()
      }
      return
    }
  },

  abandonQuestChain: () => {
    const { sect } = get()
    if (!sect.quest) return
    const chain = questChainById(sect.quest.chainId)
    log(`放弃任务链「${chain?.name ?? '未知委托'}」，进度不保留。`, 'dim')
    set({ sect: { ...sect, quest: null } })
  },

  upgradeSectBuilding: (which) => {
    const { sect, player } = get()
    if (!player || !sect.sectId) return
    if (sect.rank !== 'master' && sect.rank !== 'supreme') {
      log('宗门建设须宗主（或太上长老）推行。', 'bad')
      return
    }
    const lv = which === 'library' ? sect.libraryLv : sect.marketLv
    if (lv >= 3) {
      log('此建筑已至当前上限。', 'dim')
      return
    }
    const cost = 300 * (lv + 1) + 100 * lv * lv
    if (sect.contribution < cost) {
      log(`建设需自贡献池支取 ${cost} 贡献，当前不足。`, 'bad')
      return
    }
    const name = which === 'library' ? '藏经阁扩容' : '坊市让利'
    log(`宗门建设「${name}」升至 ${lv + 1} 级（消耗贡献 ${cost}）。`, 'gold')
    set({
      sect: {
        ...sect,
        contribution: sect.contribution - cost,
        libraryLv: which === 'library' ? lv + 1 : sect.libraryLv,
        marketLv: which === 'market' ? lv + 1 : sect.marketLv,
      },
    })
    afterProgressSnapshot(get, set)
  },


  donateToPool: (amount) => {
    const { player, stones, sect } = get()
    if (!player || !sect.sectId || !player.alive) return
    const n = Math.floor(amount)
    if (n <= 0 || stones < n) {
      log('灵石不足。', 'bad')
      return
    }
    const gain = stonesToPool(n)
    if (gain <= 0) {
      log('至少捐献 10 灵石才能入池。', 'dim')
      return
    }
    log('捐献灵石 ' + n + '，贡献池 +' + gain + '。', 'gold')
    playChime()
    set({
      stones: stones - n,
      sect: { ...sect, pool: sect.pool + gain },
    })
  },

  allocateToPool: (amount) => {
    const { player, sect } = get()
    if (!player || !sect.sectId) return
    if (sect.rank !== 'master' && sect.rank !== 'supreme') {
      log('拨款须宗主（或太上）推行。', 'bad')
      return
    }
    const n = Math.floor(amount)
    if (n <= 0 || sect.contribution < n) {
      log('个人贡献不足。', 'bad')
      return
    }
    log('宗主拨款：个人贡献 ' + n + ' → 贡献池。', 'gold')
    playChime()
    set({
      sect: {
        ...sect,
        contribution: sect.contribution - n,
        pool: sect.pool + n,
      },
    })
  },

  upgradeSectBuildingYard: (id) => {
    const { player, sect } = get()
    if (!player || !sect.sectId) return
    const def = SECT_BUILDING_MAP[id]
    if (!def) return
    if (sect.rank !== 'master' && sect.rank !== 'supreme') {
      log('建筑升级须宗主（或太上）推行。长老可「提议」造势。', 'bad')
      return
    }
    const lv = buildingLevel(sect.buildings, id)
    if (lv >= def.maxLevel) {
      log('「' + def.name + '」已至上限。', 'dim')
      return
    }
    const cost = buildingUpgradeCost(def, lv)
    if (sect.pool < cost) {
      log('贡献池不足 ' + cost + '（当前 ' + sect.pool + '）。', 'bad')
      return
    }
    log('宗门建设：「' + def.name + '」升至 ' + (lv + 1) + ' 级（池 -' + cost + '）。', 'gold')
    playBell()
    set({
      sect: {
        ...sect,
        pool: sect.pool - cost,
        buildings: { ...sect.buildings, [id]: lv + 1 },
      },
    })
  },

  proposeSectBuilding: (id) => {
    const { player, sect } = get()
    if (!player || !sect.sectId) return
    const def = SECT_BUILDING_MAP[id]
    if (!def) return
    if (sectRankIndex(sect.rank) < sectRankIndex('elder')) {
      log('长老以上方可于议事堂提案。', 'bad')
      return
    }
    log('你提议修缮「' + def.name + '」，众长老颔首记档（纯叙事）。', 'dim')
  },


  obtainPet: (petId, name) => {
    const def = PET_MAP[petId]
    if (!def) return
    const next: PetState = {
      petId,
      name: (name || def.name).slice(0, 8),
      level: 1,
      exp: 0,
      bond: 10,
      job: 'none',
      jobOn: '',
      restUntilDay: 0,
      captureFails: 0,
    }
    log('灵兽认主：' + next.name + '。', 'gold')
    set({ pet: next })
  },
  renamePet: (name) => {
    const { pet } = get()
    if (!pet) return
    set({ pet: { ...pet, name: name.trim().slice(0, 8) || pet.name } })
  },
  feedPet: () => {
    const { pet, inventory } = get()
    if (!pet) return
    const foodId = ['herb_qi', 'pill_qi', 'herb_moon', 'pill_heal'].find((id) => (inventory[id] ?? 0) > 0)
    if (!foodId) {
      log('没有合适的灵食。', 'bad')
      return
    }
    const inv = { ...inventory, [foodId]: (inventory[foodId] ?? 0) - 1 }
    if (inv[foodId] <= 0) delete inv[foodId]
    let exp = pet.exp + PET_FEED_EXP
    let level = pet.level
    while (level < PET_MAX_LEVEL && exp >= petExpNeed(level)) {
      exp -= petExpNeed(level)
      level += 1
    }
    log('喂食 ' + (ITEMS[foodId]?.name ?? foodId) + '，亲密 +2。', 'good')
    set({ inventory: inv, pet: { ...pet, exp, level, bond: Math.min(100, pet.bond + 2) } })
  },
  breakthroughPet: () => {
    const { pet } = get()
    if (!pet || pet.level < 10) {
      log('灵兽需 Lv.10 方可突破。', 'bad')
      return
    }
    log(pet.name + ' 突破成功！', 'gold')
    set({ pet: { ...pet, level: Math.min(PET_MAX_LEVEL, pet.level + 1), bond: Math.min(100, pet.bond + 10) } })
  },
  setPetJob: (job) => {
    const { pet } = get()
    if (!pet) return
    set({ pet: { ...pet, job } })
  },
  releasePet: () => {
    const { pet } = get()
    if (!pet) return
    log('放生 ' + pet.name + '。', 'dim')
    set({ pet: null })
  },
  petFarmAssist: () => {
    const { pet, abode, inventory, time } = get()
    if (!pet || pet.job !== 'farm') return
    const day = String(dayNumber(time))
    if (pet.jobOn === day) {
      log('灵兽今日已协助。', 'dim')
      return
    }
    const inv = { ...inventory }
    let harvested = 0
    const plots = abode.plots.map((plot) => {
      const prog = plotProgress(plot, time)
      if (!plot.seedId || !prog.ready || Math.random() > PET_FARM_ASSIST_MUL * 2) return plot
      const seed = SEEDS[plot.seedId]
      if (!seed) return { seedId: null, plantedDay: 0 }
      const n = Math.max(1, Math.floor(harvestYield(plot.seedId) * 0.5))
      inv[seed.yieldItemId] = (inv[seed.yieldItemId] ?? 0) + n
      harvested += n
      return { seedId: null, plantedDay: 0 }
    })
    log(pet.name + ' 协助灵田，收获 ' + harvested + '（不增修为）。', 'good')
    set({
      inventory: inv,
      abode: { ...abode, plots },
      pet: { ...pet, jobOn: day, bond: Math.min(100, pet.bond + 1) },
    })
  },

  redeemSectFragment: () => {
    const { sect, player, inventory, gongfa, treasures, legacy } = get()
    if (!player || !sect.sectId) return
    if ((inventory.sect_fragment ?? 0) < 3) {
      log('集齐 3 张藏经残页方可参悟。', 'bad')
      return
    }
    const cur = SECTS.find((s) => s.id === sect.sectId)
    if (!cur) return
    const candidates = cur.library.filter((l) => !gongfa.learned[l.id])
    if (candidates.length === 0) {
      log('本宗藏经阁秘法已尽数参悟。', 'dim')
      return
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    const inv = { ...inventory }
    inv.sect_fragment = (inv.sect_fragment ?? 0) - 3
    if (inv.sect_fragment <= 0) delete inv.sect_fragment
    const learned = { ...gongfa.learned, [pick.id]: { stage: 0 } }
    const p = recomputeVitals({ ...player }, treasures, learned, legacy.daoMarks)
    log(`残页合一，灵光乍现：《${pick.name}》参悟入门。`, 'gold')
    set({
      player: p,
      inventory: inv,
      gongfa: { learned },
      sect: { ...sect, fragmentsUsed: sect.fragmentsUsed + 1 },
    })
    unlockCodex(get, set, 'gongfa', pick.id)
    unlockCodex(get, set, 'item', 'sect_fragment')
    afterProgressSnapshot(get, set)
  },

  useItem: (id) => {
    const { player, inventory } = get()
    if (!player || !player.alive) return
    const count = inventory[id] ?? 0
    const item = ITEMS[id]
    if (count <= 0 || !item?.effect) return
    // 突破辅助丹药：冲击壁垒时自动选用并消耗，不可提前服用
    if (item.effect.breakthroughRate && !item.effect.hp && !item.effect.exp && !item.effect.energy) {
      log(`「${item.name}」将在冲击壁垒时自动服用（成功率 +${item.effect.breakthroughRate}%）。`, 'dim')
      return
    }
    // 起步境界门槛
    if (!itemMinRealmOk(item, player.realm)) {
      const lo = item.minRealm ? REALMS[item.minRealm]?.name ?? item.minRealm : ''
      log(`境界不足：「${item.name}」需${lo}以上方可服用。`, 'bad')
      return
    }
    const over = itemOverScope(item, player.realm)
    const eff = itemEffectWithMarks(item)
    const inv = { ...inventory, [id]: count - 1 }
    if (inv[id] <= 0) delete inv[id]
    const p = { ...player }
    const markNote = (item.danMarks ?? 0) > 0 ? `（${item.danMarks}纹药力）` : ''
    const scopeNote = over ? '（已超适用范围，药效大减）' : ''
    const scopeMul = over ? 0.25 : 1
    // 特殊功效
    if (eff.special === 'full_heal') {
      p.hp = p.maxHp
      p.energy = p.maxEnergy
    }
    if (eff.special === 'cleanse') {
      if (p.classId === 'demon' && p.shaqi > 0) {
        p.shaqi = Math.max(0, p.shaqi - 15)
      }
    }
    if (eff.hp) {
      const h = Math.floor(eff.hp * scopeMul)
      p.hp = Math.min(p.maxHp, p.hp + h)
    }
    if (eff.energy) {
      p.energy = Math.min(p.maxEnergy, p.energy + Math.floor(eff.energy * scopeMul))
    }
    if (eff.stone) {
      // 由 useItem 外层 stones 更新
    }
    if (eff.exp) {
      const raw = id.startsWith('pill_qi')
        ? pillExp(player.realm, item.pillGrade, item.danMarks)
        : eff.exp
      const gain = Math.floor(raw * scopeMul)
      p.exp += gain
      log(`服用 ${item.name}${markNote}，修为 +${gain}${scopeNote}`, 'good')
    } else if (eff.special === 'full_heal') {
      log(`服用 ${item.name}${markNote}，伤势尽复、灵力回满。`, 'gold')
    } else if (eff.special === 'cleanse') {
      log(`服用 ${item.name}${markNote}，心魔杂念为之一清${scopeNote}。`, 'good')
    } else if (eff.hp || eff.energy) {
      log(`服用 ${item.name}${markNote}，气血/灵力有所恢复${scopeNote}。`, 'good')
    } else {
      log(`使用 ${item.name}${markNote}。`, 'good')
    }
    if (eff.stone) {
      const s = Math.floor(eff.stone * scopeMul)
      useGameStore.setState({ stones: useGameStore.getState().stones + s })
      log(`灵石 +${s}`, 'good')
    }
    if (item.pillGrade || item.herbTier) {
      log(`${itemTierText(item)}${itemScopeText(item) ? ` · ${itemScopeText(item)}` : ''}`, 'dim')
    }
    set({ player: p, inventory: inv })
    unlockCodex(get, set, 'item', id)
    afterProgressSnapshot(get, set)
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
    if (!canLearnGongfaFull(g, player.realm)) {
      log(
        `参悟《${g.name}》需达${gongfaRealmText(g)}且品阶相称（${g.grade} · ${gongfaScopeText(g)}）。`,
        'bad',
      )
      return
    }
    const inv = { ...inventory }
    inv[scrollItemId] = (inv[scrollItemId] ?? 0) - 1
    if (inv[scrollItemId] <= 0) delete inv[scrollItemId]
    const learned = { ...gongfa.learned, [g.id]: { stage: 0 } }
    const p = recomputeVitals({ ...player }, treasures, learned, legacy.daoMarks)
    log(`你翻开《${g.name}》，朝夕参诵，功法入门。`, 'gold')
    set({ inventory: inv, gongfa: { learned }, player: p })
    unlockCodex(get, set, 'gongfa', g.id)
    afterProgressSnapshot(get, set)
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
    // 残卷功法进阶更省
    const fromSeal = (legacy.sealed ?? []).some((s) => s.kind === 'gongfa' && s.id === id)
    const cost = Math.floor(gongfaAdvanceCost(g, st.stage) * (fromSeal ? 0.7 : 1))
    if (player.exp < cost) {
      log(`进阶「${GONGFA_STAGE_LABELS[st.stage + 1]}」需消耗修为 ${cost}，当前修为不足。`, 'bad')
      return
    }
    const learned = { ...gongfa.learned, [id]: { stage: st.stage + 1 } }
    const p = recomputeVitals({ ...player, exp: player.exp - cost }, treasures, learned, legacy.daoMarks)
    log(
      `修为灌顶，《${g.name}》修至「${GONGFA_STAGE_LABELS[st.stage + 1]}」！${fromSeal ? '（残卷余韵，消耗降低）' : ''}`,
      'gold',
    )
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
    let nextArts = get().artifacts
    if (isTreasure) {
      // 坊市现货按凡品入库；无同类出战则认主
      const hasActive = treasures.includes(id)
      const inst = {
        ...createArtifactInstance({ itemId: id, quality: 'mortal' as ArtifactQuality, qualityCap: 'mortal' as ArtifactQuality }),
        equipped: !hasActive,
        affixes: [] as { id: string }[],
      }
      nextArts = [...get().artifacts, inst]
    }
    log(`购入 ${item.name}，花费灵石 ${item.price}`, 'dim')
    set({
      inventory: inv,
      stones: stones - item.price,
      treasures: newTreasures,
      artifacts: nextArts,
      player: p,
    })
    unlockCodex(get, set, 'item', id)
    afterProgressSnapshot(get, set)
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
    if (get().activeCombat && !get().activeCombat!.finished) {
      log('战斗进行中，无法处理宗门委托。', 'bad')
      return
    }
    const key = `${time.year}-${time.month}-${time.day}`
    if (sect.taskDoneOn === key) {
      log('今日宗门任务已完成。', 'dim')
      return
    }
    const rankMul = SECT_RANKS[sect.rank].taskMul
    const gain = Math.floor((15 + Math.floor(Math.random() * 20)) * rankMul)
    const poolCut = commissionPoolCutOf(gain)
    const stone = 20 + Math.floor(Math.random() * 30)
    const advanced = advanceTime(time, 1)
    log(`完成宗门委托：贡献 +${gain}，灵石 +${stone}${poolCut ? '，池 +' + poolCut : ''}`, 'good')
    set({
      time: advanced.time,
      stones: stones + stone,
      sect: { ...sect, contribution: sect.contribution + gain, pool: sect.pool + poolCut, taskDoneOn: key },
      player: {
        ...player,
        age: player.age + advanced.agedYears,
        lifespanLeft: player.lifespanLeft - advanced.agedYears,
      },
    })
  },

  sectExchange: (itemId, cost) => {
    const { sect, inventory } = get()
    if (get().activeCombat && !get().activeCombat!.finished) {
      log('战斗进行中，无法兑换物资。', 'bad')
      return
    }
    if (!sect.sectId) {
      log('未入宗门。', 'bad')
      return
    }
    // 坊市让利：宗主建设折扣
    const actual = Math.max(1, Math.floor(cost * (1 - 0.04 * sect.marketLv)))
    if (sect.contribution < actual) {
      log('贡献不足。', 'bad')
      return
    }
    const inv = { ...inventory }
    inv[itemId] = (inv[itemId] ?? 0) + 1
    log(
      `以贡献兑换「${ITEMS[itemId]?.name ?? itemId}」${actual < cost ? `（建设让利，实付 ${actual}）` : ''}。`,
      'gold',
    )
    set({ inventory: inv, sect: { ...sect, contribution: sect.contribution - actual } })
    unlockCodex(get, set, 'item', itemId)
    afterProgressSnapshot(get, set)
  },

  sectLearn: (libId, cost) => {
    const { sect, player, gongfa, treasures, legacy } = get()
    if (!sect.sectId || !player) {
      log('贡献不足或未入门。', 'bad')
      return
    }
    // 藏经阁扩容折扣
    const actual = Math.max(1, Math.floor(cost * (1 - 0.05 * sect.libraryLv)))
    if (sect.contribution < actual) {
      log('贡献不足。', 'bad')
      return
    }
    const g = GONGFAS[libId]
    if (!g) return
    if (gongfa.learned[libId]) {
      log('此功法已在修习之中。', 'dim')
      return
    }
    if (!canLearnGongfaFull(g, player.realm)) {
      log(
        `参悟《${g.name}》需达${gongfaRealmText(g)}且品阶相称（${g.grade} · ${gongfaScopeText(g)}）。`,
        'bad',
      )
      return
    }
    const learned = { ...gongfa.learned, [libId]: { stage: 0 } }
    const p = recomputeVitals({ ...player }, treasures, learned, legacy.daoMarks)
    log(
      `藏经阁中灵光乍现，《${g.name}》参悟入门。${actual < cost ? `（扩容折扣，实付 ${actual}）` : ''}`,
      'gold',
    )
    set({
      player: p,
      gongfa: { learned },
      sect: { ...sect, contribution: sect.contribution - actual },
    })
    unlockCodex(get, set, 'gongfa', libId)
    afterProgressSnapshot(get, set)
  },

  sectGrandCompetition: () => {
    const { player, sect, treasures } = get()
    if (!player || !player.alive || isAscended(player) || get().pendingEvent || get().pendingStory || get().tower || get().activeCombat) return
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
      pendingStory: null,
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
    afterProgressSnapshot(get, set)
  },

  enterTower: (realmId) => {
    const { player, tower } = get()
    if (!player || !player.alive || isAscended(player) || tower) return
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
    unlockCodex(get, set, 'secret', realmId)
    afterProgressSnapshot(get, set)
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
    const spouseHurt = (companion.spouseHurtUntilDay ?? 0) > dayNumber(get().time)
    if (spouse && !spouseHurt) actor.atk = Math.floor(actor.atk * 1.08)
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
    // 设置开启时：本层直接自动结算，不进入交互战斗面板
    if (get().skipExploreCombat) {
      get().runCombatAutoToEnd()
    }
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
    if (next >= 1) unlockCodex(get, set, 'companion', id)
    if (heartTexts.length > 0) afterProgressSnapshot(get, set)
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
    if (next >= 1) unlockCodex(get, set, 'companion', id)
    if (heartTexts.length > 0) afterProgressSnapshot(get, set)
  },

  dualCultivate: (id) => {
    const { companion, player, time } = get()
    if (!player || !player.alive || isAscended(player)) return
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
    if ((companion.spouseHurtUntilDay ?? 0) > dayNumber(time)) {
      log(`${c.name}重伤未愈，无法双修。`, 'bad')
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
    if (companion.spouseId === id) maybeTriggerSpouseStory(get, set)
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
      companion: { ...companion, spouseId: id, postStage: { ...companion.postStage, [id]: companion.postStage[id] ?? 0 } },
    })
    unlockCodex(get, set, 'companion', id)
    afterProgressSnapshot(get, set)
    maybeTriggerSpouseStory(get, set)
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
    } catch (e) {
      console.warn(e)
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
      const lifespanFloor = REALMS[snap.player.realm]?.lifespan ?? REALMS.qi.lifespan
      const wasFullHp = snap.player.hp >= snap.player.maxHp - 1
      const wasFullEn = snap.player.energy >= snap.player.maxEnergy - 1
      const legacy = migrateLegacy(snap.legacy)
      const companion = migrateCompanion(snap.companion)
      const pet = migratePet((snap as { pet?: unknown }).pet)
      const inventory = sanitizeInventory(snap.inventory)
      const treasures = snap.treasures ?? []
      const towerBest = snap.towerBest ?? {}
      // 旧档：境界已是飞升则补写 ascended，避免「已飞升却走道消」
      const rawPlayer = snap.player
      const playerFixed: PlayerState = isAscended(rawPlayer)
        ? {
            ...rawPlayer,
            ascended: true,
            alive: true,
            lifespanLeft: Math.max(
              rawPlayer.lifespanLeft,
              Math.floor(REALMS.ascended.lifespan * 1),
            ),
          }
        : rawPlayer
      const derived = deriveCollectionFromState({
        player: playerFixed,
        gongfa: migratedGongfa,
        treasures,
        inventory,
        companion,
        towerBest,
        legacy,
      })
      const migratedMeta = migrateMeta(snap.meta)
      const meta: MetaState = {
        ...migratedMeta,
        collection: mergeCollection(migratedMeta.collection, derived),
        // 旧档首次带入 meta：不倒扣离线收益，锚点重置为现在
        lastOnlineAt: snap.meta?.lastOnlineAt && snap.meta.lastOnlineAt <= Date.now()
          ? snap.meta.lastOnlineAt
          : Date.now(),
      }
      set({
        phase: 'play',
        time: snap.time,
        player: {
          ...playerFixed,
          maxHp,
          maxEnergy,
          // 曲线调整后：原先满血/满灵的角色读档即按新上限回满
          hp: wasFullHp ? maxHp : Math.min(maxHp, playerFixed.hp),
          energy: wasFullEn ? maxEnergy : Math.min(maxEnergy, playerFixed.energy),
          lifespanLeft: isAscended(playerFixed)
            ? playerFixed.lifespanLeft
            : Math.max(playerFixed.lifespanLeft, Math.floor(lifespanFloor * 0.3)),
        },
        stones: snap.stones,
        inventory,
        sect: migratedSect,
        treasures,
        artifacts: (() => {
          const list = Array.isArray(snap.artifacts)
            ? snap.artifacts.map((a) => ({
                uid: String(a.uid),
                itemId: String(a.itemId ?? ''),
                name: artifactDisplayName(String(a.itemId), String(a.name ?? '')),
                quality: (a.quality as ArtifactQuality) ?? 'mortal',
                affixes: Array.isArray(a.affixes)
                  ? a.affixes.map((x) =>
                      typeof x === 'string' ? { id: String(x) } : { id: String((x as { id?: string })?.id ?? x) },
                    )
                  : [],
                equipped: Boolean(a.equipped),
                recipeId: a.recipeId,
              }))
            : []
          if (list.length > 0) return list.filter((a) => a.itemId)
          // 旧档 treasures 迁成凡品实例，同类首件出战
          const seen = new Set<string>()
          return treasures.map((id) => {
            const first = !seen.has(id)
            seen.add(id)
            return {
              ...createArtifactInstance({
                itemId: id,
                quality: 'mortal',
                qualityCap: 'mortal',
              }),
              equipped: first,
              affixes: [] as { id: string }[],
            }
          })
        })(),
        companion,
        pet,
        gongfa: migratedGongfa,
        towerBest,
        abode: migrateAbode(snap.abode),
        legacy,
        meta,
        offlinePending: null,
        tower: null,
        lastCombat: null,
        pendingEvent: null,
        pendingStory: null,
        activeCombat: null,
        activePanel: 'cultivate',
      })
      processMetaProgress(get, set)
      trySettleOffline(get, set)
      return true
    } catch (e) {
      console.warn(e)
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
    } catch (e) {
      console.warn(e)
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
      const companion = migrateCompanion(snap.companion)
      const pet = migratePet((snap as { pet?: unknown }).pet)
      const inventory = sanitizeInventory(snap.inventory ?? {})
      const treasures = snap.treasures ?? []
      const towerBest = snap.towerBest ?? {}
      const legacy = migrateLegacy(snap.legacy)
      const playerFixed: PlayerState = isAscended(snap.player)
        ? {
            ...snap.player,
            ascended: true,
            alive: true,
            lifespanLeft: Math.max(
              snap.player.lifespanLeft,
              Math.floor(REALMS.ascended.lifespan),
            ),
          }
        : snap.player
      const derived = deriveCollectionFromState({
        player: playerFixed,
        gongfa: migratedGongfa,
        treasures,
        inventory,
        companion,
        towerBest,
        legacy,
      })
      const migratedMeta = migrateMeta(snap.meta)
      const meta: MetaState = {
        ...migratedMeta,
        collection: mergeCollection(migratedMeta.collection, derived),
        lastOnlineAt:
          snap.meta?.lastOnlineAt && snap.meta.lastOnlineAt <= Date.now()
            ? snap.meta.lastOnlineAt
            : Date.now(),
      }
      set({
        phase: 'play',
        time: snap.time,
        player: playerFixed,
        stones: snap.stones ?? 0,
        inventory,
        sect: migratedSect,
        treasures,
        artifacts: (() => {
          const list = Array.isArray(snap.artifacts)
            ? snap.artifacts.map((a) => ({
                uid: String(a.uid),
                itemId: String(a.itemId ?? ''),
                name: artifactDisplayName(String(a.itemId), String(a.name ?? '')),
                quality: (a.quality as ArtifactQuality) ?? 'mortal',
                affixes: Array.isArray(a.affixes)
                  ? a.affixes.map((x) =>
                      typeof x === 'string' ? { id: String(x) } : { id: String((x as { id?: string })?.id ?? x) },
                    )
                  : [],
                equipped: Boolean(a.equipped),
                recipeId: a.recipeId,
              }))
            : []
          if (list.length > 0) return list.filter((a) => a.itemId)
          // 旧档 treasures 迁成凡品实例，同类首件出战
          const seen = new Set<string>()
          return treasures.map((id) => {
            const first = !seen.has(id)
            seen.add(id)
            return {
              ...createArtifactInstance({
                itemId: id,
                quality: 'mortal',
                qualityCap: 'mortal',
              }),
              equipped: first,
              affixes: [] as { id: string }[],
            }
          })
        })(),
        companion,
        pet,
        gongfa: migratedGongfa,
        towerBest,
        abode: migrateAbode(snap.abode),
        legacy,
        meta,
        offlinePending: null,
        tower: null,
        lastCombat: null,
        pendingEvent: null,
        pendingStory: null,
        activeCombat: null,
      })
      processMetaProgress(get, set)
      trySettleOffline(get, set)
      log('存档导入成功。', 'gold')
      return true
    } catch (e) {
      console.warn(e)
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
    } catch (e) {
      console.warn(e)
      return false
    }
  },
}))
