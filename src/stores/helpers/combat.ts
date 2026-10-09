import { CLASSES } from '../../data/classes'
import { ENEMY_TEMPLATES, enemyTemplateId } from '../../data/enemies'
import { ITEMS } from '../../data/items'
import {
  PET_ASSIST_CD,
  PET_ASSIST_DMG_MUL,
  PET_GUARD_LOSS_REDUCE,
  PET_MAP,
  petAssistChance,
  petStatBonus,
  type PetState,
} from '../../data/pets'
import { realmCombatBase } from '../../data/realms'
import { nextSectRank, SECT_RANKS } from '../../data/sects'
import { SECRET_REALMS, isBossFloor } from '../../data/secretRealms'
import { buildingAtkMul } from '../../data/sectBuildings'
import {
  buildPlayerCombatActor,
  combatResultFromState,
  createCombatState,
  type CombatActor,
  type CombatContext,
  type CombatEngineResult,
  type CombatEngineState,
  type CombatPetInfo,
} from '../../game/combatEngine'
import {
  artifactBattleExtras,
  gongfaBonuses,
  repDeltaOnKill,
  treasureBonus,
} from '../../game/combatStats'
import { advanceTime } from '../../game/day'
import { clamp } from '../../game/format'
import { addItem, removeItem } from '../../game/inventory'
import type { EnemyDef, GameTime, PlayerState } from '../../types'
import type { MetaGet, MetaSet } from '../gameState'
import { bumpDaily } from './daily'
import { log } from './log'
import { afterProgressSnapshot, unlockCodex } from './progress'
import {
  bumpQuestExploreWin,
  currentRules,
  maybeTriggerSpouseStory,
  pickEvent,
} from './shared'
import { worldEventById, type WorldEvent } from '../../data/events'
import { clampWanted, wantedHuntChance, wantedLabel } from '../../game/bounty'
import { isDemonicChampion, REP_EXPLORE_STONE_MUL } from '../../game/reputation'

export function makePlayerCombatant(get: MetaGet, player: PlayerState, treasures: string[], hpScale = 1): CombatActor {
  const snap = get()
  const artifacts = snap.artifacts
  const gb = gongfaBonuses(snap.gongfa.learned, snap.player?.realm)
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
    atk: Math.floor(base.atk * CLASSES[player.classId].atkMul * tb.atk * gb.atk * (1 + petStatBonus(snap.pet).atk) * buildingAtkMul(snap.sect.buildings, { isExam: snap.activeCombat?.context?.kind === 'sect_exam' })),
    def: Math.floor(base.def * CLASSES[player.classId].defMul * tb.def * gb.def),
    dmgReduce: gb.dodge + extras.dmgReduce,
    dodge: Math.min(0.25, tb.dodge),
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

/** v1.2 出战灵兽的协战参数；未出战或无灵兽返回 undefined */
function petCombatInfo(pet: PetState | null): CombatPetInfo | undefined {
  if (!pet || !pet.fight) return undefined
  const def = PET_MAP[pet.petId]
  if (!def) return undefined
  return {
    name: pet.name,
    skillId: def.skillId,
    skillName: def.skillName,
    assistChance: petAssistChance(pet),
    cd: PET_ASSIST_CD,
    power: PET_ASSIST_DMG_MUL,
  }
}

/** 所有战斗统一注入出战灵兽协战参数 */
export function withPetCombat(ctx: CombatContext, pet: PetState | null): CombatContext {
  const info = petCombatInfo(pet)
  return info ? { ...ctx, pet: info } : ctx
}

export function startEngineCombat(
  get: MetaGet,
  set: MetaSet,
  opts: {
    enemy: EnemyDef
    context: CombatContext
    hpScale?: number
    exploring?: boolean
  },
) {
  const { player, treasures, pet } = get()
  if (!player) return
  const actor = makePlayerCombatant(get, player, treasures, opts.hpScale ?? 1)
  const state = createCombatState(actor, opts.enemy, withPetCombat(opts.context, pet))
  // 开场按设置托管；灵力与存档对齐
  set({
    activeCombat: state,
    autoCombat: get().autoCombatDefault,
    exploring: opts.exploring ?? false,
    lastCombat: null,
    player: {
      ...player,
      energy: Math.min(player.maxEnergy, actor.energy),
    },
  })
}

export function applyCombatConsumables(
  state: CombatEngineState,
  inventory: Record<string, number>,
): Record<string, number> {
  const inv = { ...inventory }
  for (const id of state.potionsUsed) {
    if ((inv[id] ?? 0) > 0) removeItem(inv, id)
  }
  for (const id of state.blastPillsUsed) {
    if ((inv[id] ?? 0) > 0) removeItem(inv, id)
  }
  return inv
}

/** settleActiveCombat 预算好并传给各场景结算器的公共上下文 */
interface SettleArgs {
  get: MetaGet
  set: MetaSet
  player: PlayerState
  time: GameTime
  enemy: EnemyDef
  result: CombatEngineResult
  lines: string[]
  inv: Record<string, number>
  hpLeft: number
  lifespanLeft: number
  nextPlayer: PlayerState
}

function settleExploreCombat(args: SettleArgs) {
  const { get, set, player, time, enemy, result, lines, inv, hpLeft, lifespanLeft } = args
  let nextPlayer = args.nextPlayer
  const advanced = advanceTime(time, 1)
  nextPlayer.age = player.age + advanced.agedYears
  nextPlayer.lifespanLeft = lifespanLeft - advanced.agedYears
  if (result.win) {
    const rep = repDeltaOnKill(enemy)
    const dropRate = enemy.loot.dropRate ?? 1
    // v1.4 魔道魁首历练灵石收益 +10%
    const stoneMul =
      currentRules().exploreStoneMul * (isDemonicChampion(player.repDemonic) ? REP_EXPLORE_STONE_MUL : 1)
    if (result.itemId && ITEMS[result.itemId] && Math.random() < dropRate) {
      addItem(inv, result.itemId)
      lines.push(`获得「${ITEMS[result.itemId].name}」×1`)
    }
    if (Math.random() < 0.12) {
      addItem(inv, 'tiger_bone')
      lines.push('获得「虎王骨」×1')
    }
    const stoneGain = Math.floor(result.stoneGain * stoneMul)
    log(`历练遭遇 ${enemy.name}，获胜。`, 'good')
    log(`修为 +${result.expGain}，灵石 +${stoneGain}`, 'good')
    if (enemy.faction === 'demonic') {
      log(`斩杀魔修：正道声望 +${rep.right}，魔道声望 +${rep.demonic}`, 'dim')
    }
    // v1.4 通缉：魔修截杀正道修士升档；魔道魁首免于升档
    let wantedNext = get().wanted
    if (player.classId === 'demon' && enemy.faction === 'righteous' && !isDemonicChampion(player.repDemonic)) {
      wantedNext = clampWanted(wantedNext + 1)
      log(`你截杀了正道修士，缉魔令上又添一笔（通缉 ${wantedLabel(wantedNext)}）。`, 'bad')
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
      wanted: wantedNext,
      meta: {
        ...meta,
        stats: { ...meta.stats, combatsWon: meta.stats.combatsWon + 1 },
      },
    })
    unlockCodex(get, set, 'enemy', enemyTemplateId(enemy.id))
    if (result.itemId) unlockCodex(get, set, 'item', result.itemId)
    bumpQuestExploreWin(get, set)
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
  const huntEvt = maybeWantedHunt(get)
  if (huntEvt) {
    set({ pendingEvent: { event: huntEvt, kind: 'explore' } })
  } else {
    const evt = pickEvent(get)
    if (evt) set({ pendingEvent: { event: evt, kind: 'explore' } })
  }
  bumpDaily(get, set, 'explore')
  maybeTriggerSpouseStory(get, set)
}

/** v1.4 通缉追杀：魔修通缉 ≥2 后每次历练有概率被缉魔使拦路（魔道魁首免疫） */
function maybeWantedHunt(get: MetaGet): WorldEvent | null {
  const s = get()
  if (!s.player || s.pendingEvent || s.pendingStory || s.activeCombat) return null
  if (s.player.classId !== 'demon' || isDemonicChampion(s.player.repDemonic)) return null
  if (Math.random() >= wantedHuntChance(s.wanted)) return null
  return worldEventById('wanted_hunt')
}

function settleTowerCombat(args: SettleArgs) {
  const { get, set, player, enemy, result, lines, inv, hpLeft, nextPlayer } = args
  const { tower } = get()
  const realm = tower ? SECRET_REALMS.find((r) => r.id === tower.realmId) : null
  if (!tower || !realm) {
    set({ activeCombat: null, exploring: false })
    return
  }
  const boss = isBossFloor(realm, tower.floor)
  if (result.win) {
    if (result.itemId && Math.random() < (enemy.loot.dropRate ?? 0)) {
      addItem(inv, result.itemId)
      lines.push(`获得「${ITEMS[result.itemId]?.name}」`)
    }
    // v1.4 飞升秘境：每通关一层得仙缘 +20（仙界遗珍 DLC 再乘 favorMul）
    const favorGain =
      realm.minRealm === 'ascended' ? Math.floor(20 * currentRules().favorMul) : 0
    if (favorGain > 0) lines.push(`仙机感悟，仙缘 +${favorGain}`)
    const best = Math.max(get().towerBest[realm.id] ?? 0, tower.floor)
    const clearedAll = tower.floor >= realm.floors
    log(
      `秘境通关第 ${tower.floor} 层${boss ? '（镇守）' : ''}：修为 +${result.expGain}，灵石 +${result.stoneGain}${favorGain ? `，仙缘 +${favorGain}` : ''}`,
      'gold',
    )
    const meta = get().meta
    set({
      inventory: inv,
      stones: get().stones + result.stoneGain,
      favor: get().favor + favorGain,
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
    bumpQuestExploreWin(get, set)
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
}

function settleExamCombat(args: SettleArgs) {
  const { get, set, player, enemy, result, lines, hpLeft, nextPlayer } = args
  const { sect, time: examStartTime } = get()
  const advanced = advanceTime(examStartTime, 1)
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
}

function settleEventCombat(args: SettleArgs) {
  const { set, enemy, result, lines, nextPlayer } = args
  // event 等其它场景：仅写回战斗结果
  set({
    activeCombat: null,
    lastCombat: { enemy, win: result.win, log: lines },
    player: nextPlayer,
  })
}

/** 战斗结束后按场景结算奖励/惩罚，并写回角色 */
export function settleActiveCombat(get: MetaGet, set: MetaSet) {
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
  const inv = applyCombatConsumables(state, get().inventory)
  const hpScale = ctx.hpScale ?? 1
  const hpLeft = realHpAfterScaledCombat(player.hp, hpScale, result.playerHpLeft)
  const energyLeft = Math.max(0, Math.min(player.maxEnergy, result.playerEnergyLeft))
  const lifespanLeft = Math.max(1, player.lifespanLeft - result.lifespanCost)
  const nextPlayer: PlayerState = {
    ...player,
    hp: hpLeft,
    energy: energyLeft,
    lifespanLeft,
  }
  const args: SettleArgs = {
    get,
    set,
    player,
    time,
    enemy,
    result,
    lines,
    inv,
    hpLeft,
    lifespanLeft,
    nextPlayer,
  }
  if (ctx.kind === 'explore') {
    settleExploreCombat(args)
    return
  }
  if (ctx.kind === 'tower') {
    settleTowerCombat(args)
    return
  }
  if (ctx.kind === 'sect_exam') {
    settleExamCombat(args)
    return
  }
  settleEventCombat(args)
}
