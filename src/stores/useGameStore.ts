import { create } from 'zustand'
import { CLASSES } from '../data/classes'
import { companionById, giftAffinity, type CompanionDef } from '../data/companions'
import { ENEMIES, pickEnemy } from '../data/enemies'
import { pickWorldEvent, type WorldEvent } from '../data/events'
import { ITEMS, pillExp, requiredMaterial } from '../data/items'
import { REALMS, expNeeded, realmLabel, realmMaxEnergy, realmMaxHp } from '../data/realms'
import { SECTS, type SectDef } from '../data/sects'
import {
  SECRET_REALMS,
  canEnterRealm,
  isBossFloor,
  towerEnemy,
} from '../data/secretRealms'
import {
  applyLayerDown,
  applyLayerUp,
  attemptBreakthrough,
  breakthroughRate,
  canBreakthrough,
} from '../game/breakthrough'
import { playerCombatStats, repDeltaOnKill, runCombat } from '../game/combat'
import {
  advanceTime,
  cultivateGain,
  dailyRecover,
  dayKey,
  seclusionGain,
  weatherOf,
} from '../game/day'
import { clamp } from '../game/format'
import type {
  CharacterCreateInput,
  EnemyDef,
  GameTime,
  PanelId,
  PlayerState,
  TowerRun,
} from '../types'
import { useLogStore } from './useLogStore'

const SAVE_PREFIX = 'wendao-slot-'
const SAVE_VERSION = 3

export type GamePhase = 'menu' | 'create' | 'play'

export interface SectState {
  sectId: string | null
  rank: 'disciple' | 'inner' | 'true' | 'elder'
  contribution: number
  learned: string[]
  taskDoneOn: string
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
  towerBest: Record<string, number>
  updatedAt: number
}

export interface PendingEvent {
  event: WorldEvent
  kind: 'meditate' | 'seclude' | 'explore' | 'tower'
}

function freshSect(): SectState {
  return { sectId: null, rank: 'disciple', contribution: 0, learned: [], taskDoneOn: '' }
}

function freshCompanion(): CompanionState {
  return { affinity: {}, heartsSeen: {}, spouseId: null, dualDoneOn: '' }
}

function freshPlayer(input: CharacterCreateInput): PlayerState {
  const c = CLASSES[input.classId]
  const maxHp = realmMaxHp('qi', c.hpMul)
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
    lifespanLeft: REALMS.qi.lifespan,
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

function getLearnedBonus(learned: string[]) {
  let atk = 1
  let def = 1
  let hp = 1
  let cultivate = 1
  for (const id of learned) {
    if (id === 'js_jian' || id === 'xs_sha') atk *= 1.1
    if (id === 'js_xin') cultivate *= 1.08
    if (id === 'ty_dan') cultivate *= 1.12
    if (id === 'ty_ti') hp *= 1.15
    if (id === 'ht_ti') def *= 1.15
    if (id === 'ht_mai') hp *= 1.25
    if (id === 'xs_sui') cultivate *= 1.15
    if (id === 'ym_gui') cultivate *= 1.2
  }
  return { atk, def, hp, cultivate }
}

function treasureBonus(treasures: string[]) {
  let atk = 1
  let def = 1
  let hp = 1
  if (treasures.includes('treasure_sword')) atk *= 1.25
  if (treasures.includes('treasure_mirror')) def *= 1.25
  if (treasures.includes('treasure_pagoda')) hp *= 1.3
  return { atk, def, hp }
}

function spouseDef(companion: CompanionState): CompanionDef | null {
  if (!companion.spouseId) return null
  return companionById(companion.spouseId) ?? null
}

function sectDef(id: string | null): SectDef | null {
  if (!id) return null
  return SECTS.find((s) => s.id === id) ?? null
}

function makePlayerCombatant(
  player: PlayerState,
  learned: string[],
  treasures: string[],
  hpScale = 1,
) {
  const bonus = getLearnedBonus(learned)
  const tb = treasureBonus(treasures)
  return playerCombatStats(
    player.classId,
    player.realm,
    player.layer,
    Math.floor(player.hp * hpScale),
    Math.floor(player.maxHp * hpScale),
    bonus.atk * tb.atk,
    bonus.def * tb.def,
  )
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
  /** 各秘境最高通关层 */
  towerBest: Record<string, number>
  tower: TowerRun | null
  activePanel: PanelId
  exploring: boolean
  lastCombat: { enemy: EnemyDef; win: boolean; log: string[] } | null
  pendingEvent: PendingEvent | null

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

  useItem: (id: string) => void
  sellItem: (id: string) => void
  buyItem: (id: string) => void

  joinSect: (sectId: string) => void
  leaveSect: () => void
  sectTask: () => void
  sectExchange: (itemId: string, cost: number) => void
  sectLearn: (libId: string, cost: number) => void
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
  importSave: (json: string) => boolean
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
    towerBest: s.towerBest,
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
  towerBest: {},
  tower: null,
  activePanel: 'cultivate',
  exploring: false,
  lastCombat: null,
  pendingEvent: null,

  setPanel: (p) => set({ activePanel: p }),
  startCreate: () => set({ phase: 'create' }),

  backToMenu: () => {
    useLogStore.getState().clear()
    set({
      phase: 'menu',
      player: null,
      lastCombat: null,
      pendingEvent: null,
      tower: null,
      activePanel: 'cultivate',
      sect: freshSect(),
      companion: freshCompanion(),
      treasures: [],
      towerBest: {},
    })
  },

  createCharacter: (input) => {
    const player = freshPlayer(input)
    useLogStore.getState().clear()
    log(`你名 ${player.name}，踏上修行之路。职业：${CLASSES[player.classId].name}。`, 'gold')
    log(`初始寿元 ${player.lifespanLeft} 年。${dayKey(get().time)}，天朗气清。`, 'dim')
    set({
      phase: 'play',
      player,
      time: { year: 1, month: 1, day: 1 },
      stones: 80,
      inventory: defaultInventory(),
      sect: freshSect(),
      companion: freshCompanion(),
      treasures: [],
      towerBest: {},
      tower: null,
      activePanel: 'cultivate',
      lastCombat: null,
      pendingEvent: null,
    })
  },

  meditate: () => {
    const { player, time, sect, companion } = get()
    if (!player || !player.alive || player.ascended || get().pendingEvent || get().tower) return
    const bonus = getLearnedBonus(sect.learned)
    const sdef = sectDef(sect.sectId)
    const spouse = spouseDef(companion)
    let gain = cultivateGain(player.classId, player.realm, player.layer)
    gain = Math.floor(
      gain * bonus.cultivate * (sdef?.bonus.cultivateMul ?? 1) * (spouse ? 1 + (spouse.dualMul - 1) * 0.35 : 1),
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

    const evt = pickWorldEvent(player.realm)
    if (evt) set({ pendingEvent: { event: evt, kind: 'meditate' } })
  },

  seclude: (days) => {
    const n = clamp(days, 1, 3650)
    const { player, time, sect, companion } = get()
    if (!player || !player.alive || player.ascended || get().pendingEvent || get().tower) return
    const bonus = getLearnedBonus(sect.learned)
    const sdef = sectDef(sect.sectId)
    const spouse = spouseDef(companion)
    let gain = seclusionGain(player.classId, player.realm, player.layer, n)
    gain = Math.floor(
      gain * bonus.cultivate * (sdef?.bonus.cultivateMul ?? 1) * (spouse ? 1 + (spouse.dualMul - 1) * 0.35 : 1),
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

    const evt = pickWorldEvent(player.realm)
    if (evt) set({ pendingEvent: { event: evt, kind: 'seclude' } })
  },

  breakthrough: () => {
    const { player, inventory, sect, companion } = get()
    if (!player || !player.alive || player.ascended || get().tower) return
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
    const rate = Math.min(
      95,
      breakthroughRate(player.classId, player.realm) +
        (sdef?.bonus.breakthroughBonus ?? 0) +
        spouseBonus,
    )
    const roll = Math.random() * 100
    // 用含宗门/道侣加成后的 rate 重判，保证 severity 与展示一致
    const result = attemptBreakthrough(player.classId, player.realm, player.layer, roll)
    const success = roll < rate
    const need = expNeeded(player.realm, player.layer)

    if (success) {
      const next = applyLayerUp(player.realm, player.layer)
      const inv = { ...inventory }
      if (isMajor && matId) {
        inv[matId] = (inv[matId] ?? 1) - 1
        if (inv[matId] <= 0) delete inv[matId]
      }
      const c = CLASSES[player.classId]
      const baseHp = realmMaxHp(next.realm, c.hpMul)
      const hpBonus = getLearnedBonus(sect.learned).hp
      const finalHp = Math.floor(baseHp * hpBonus)
      const maxEnergy = realmMaxEnergy(next.realm, player.classId === 'demon')
      log(result.message, 'gold')
      if (spouse) log(`${spouse.name}在旁护法，心脉安稳。`, 'dim')
      log(`（成功率约 ${Math.round(rate)}%）`, 'dim')
      set({
        inventory: inv,
        player: {
          ...player,
          realm: next.realm,
          layer: next.layer,
          exp: Math.max(0, player.exp - need),
          maxHp: finalHp,
          maxEnergy,
          hp: finalHp,
          energy: maxEnergy,
          lifespanLeft: Math.max(player.lifespanLeft, REALMS[next.realm].lifespan),
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
      player: { ...player, realm: next.realm, layer: next.layer, exp, hp, lifespanLeft },
    })
  },

  explore: () => {
    const { player, time, sect, treasures } = get()
    if (!player || !player.alive || player.ascended || get().exploring || get().pendingEvent || get().tower)
      return
    set({ exploring: true })
    const ri = Math.max(0, ['qi', 'foundation', 'golden_core'].indexOf(player.realm as 'qi'))
    const enemy = pickEnemy(ri < 0 ? 0 : ri, player.layer)
    const pStats = makePlayerCombatant(player, sect.learned, treasures)
    const result = runCombat(pStats, enemy)
    const advanced = advanceTime(time, 1)
    const lines = result.rounds.map((r) => r.text)
    lines.push(result.message)

    if (result.win) {
      const rep = repDeltaOnKill(enemy)
      const inv = { ...get().inventory }
      const dropRate = enemy.loot.dropRate ?? 1
      if (result.itemId && ITEMS[result.itemId] && Math.random() < dropRate) {
        inv[result.itemId] = (inv[result.itemId] ?? 0) + 1
        lines.push(`获得「${ITEMS[result.itemId].name}」×1`)
      }
      // 偶发炼器材
      if (Math.random() < 0.12) {
        inv.tiger_bone = (inv.tiger_bone ?? 0) + 1
        lines.push('获得「虎王骨」×1')
      }
      log(`历练遭遇 ${enemy.name}，获胜。`, 'good')
      log(`修为 +${result.expGain}，灵石 +${result.stoneGain}`, 'good')
      if (enemy.faction === 'demonic') {
        log(`斩杀魔修：正道声望 +${rep.right}，魔道声望 +${rep.demonic}`, 'dim')
      }
      set({
        time: advanced.time,
        stones: get().stones + result.stoneGain,
        inventory: inv,
        exploring: false,
        lastCombat: { enemy, win: true, log: lines },
        player: {
          ...player,
          exp: player.exp + result.expGain,
          hp: result.playerHpLeft,
          age: player.age + advanced.agedYears,
          lifespanLeft: player.lifespanLeft - advanced.agedYears,
          repRight: player.repRight + rep.right,
          repDemonic: player.repDemonic + rep.demonic,
          shaqi:
            player.classId === 'demon'
              ? clamp(player.shaqi + (enemy.faction === 'beast' ? 2 : 5), 0, 100)
              : player.shaqi,
        },
      })
    } else {
      log(`历练遭遇 ${enemy.name}，不敌败退。`, 'bad')
      set({
        time: advanced.time,
        exploring: false,
        lastCombat: { enemy, win: false, log: lines },
        stones: Math.max(0, get().stones - 15),
        player: {
          ...player,
          hp: Math.max(1, Math.floor(result.playerHpLeft || player.maxHp * 0.15)),
          age: player.age + advanced.agedYears,
          lifespanLeft: player.lifespanLeft - advanced.agedYears,
        },
      })
    }

    const evt = pickWorldEvent(player.realm)
    if (evt) set({ pendingEvent: { event: evt, kind: 'explore' } })
  },

  clearCombat: () => set({ lastCombat: null }),

  resolveEvent: (actionId) => {
    const { pendingEvent, player, inventory, stones, treasures } = get()
    if (!pendingEvent || !player) {
      set({ pendingEvent: null })
      return
    }
    const evt = pendingEvent.event
    const inv = { ...inventory }

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
      const pStats = makePlayerCombatant(player, get().sect.learned, treasures)
      const result = runCombat(pStats, enemy)
      const label = actionId === 'enter' ? '秘境探索' : '奇遇战斗'
      const lines = [`${label}：${evt.title}`, ...result.rounds.map((r) => r.text), result.message]
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
            hp: result.playerHpLeft,
            repRight: player.repRight + rep.right,
            repDemonic: player.repDemonic + rep.demonic,
          },
        })
      } else {
        log(`${label}失败：${enemy.name}`, 'bad')
        set({
          pendingEvent: null,
          lastCombat: { enemy, win: false, log: lines },
          stones: Math.max(0, get().stones - 20),
          player: { ...player, hp: Math.max(1, Math.floor(player.maxHp * 0.15)) },
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
    const inv = { ...inventory, [id]: count - 1 }
    if (inv[id] <= 0) delete inv[id]
    const p = { ...player }
    if (item.effect.hp) p.hp = Math.min(p.maxHp, p.hp + item.effect.hp)
    if (item.effect.exp) {
      const gain = id === 'pill_qi' ? pillExp(player.realm) : item.effect.exp
      p.exp += gain
      log(`服用 ${item.name}，修为 +${gain}`, 'good')
    } else {
      log(`使用 ${item.name}。`, 'good')
    }
    set({ player: p, inventory: inv })
  },

  sellItem: (id) => {
    const { inventory, stones } = get()
    const count = inventory[id] ?? 0
    const item = ITEMS[id]
    if (count <= 0 || !item) return
    if (id.startsWith('mat_') || id.startsWith('treasure_')) {
      log('突破材料与法宝不可出售。', 'bad')
      return
    }
    const inv = { ...inventory, [id]: count - 1 }
    if (inv[id] <= 0) delete inv[id]
    const price = Math.floor(item.price * 0.55)
    log(`出售 ${item.name}，得灵石 +${price}`, 'dim')
    set({ inventory: inv, stones: stones + price })
  },

  buyItem: (id) => {
    const { inventory, stones, player } = get()
    const item = ITEMS[id]
    if (!item || stones < item.price || !player) return
    const inv = { ...inventory }
    inv[id] = (inv[id] ?? 0) + 1
    log(`购入 ${item.name}，花费灵石 ${item.price}`, 'dim')
    set({ inventory: inv, stones: stones - item.price })
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
    log(`你拜入「${s.name}」，成为外门弟子。`, 'gold')
    set({ sect: { ...sect, sectId, rank: 'disciple', contribution: 0 } })
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
    const gain = 15 + Math.floor(Math.random() * 20)
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
    const { sect, player } = get()
    if (!sect.sectId || sect.contribution < cost || !player) {
      log('贡献不足或未入门。', 'bad')
      return
    }
    if (sect.learned.includes(libId)) {
      log('此法已参悟。', 'dim')
      return
    }
    let p = { ...player }
    // 即时气血类：按秘法真实倍率抬升一次
    if (libId === 'ty_ti') {
      p.maxHp = Math.floor(p.maxHp * 1.15)
      p.hp = p.maxHp
    } else if (libId === 'ht_mai') {
      p.maxHp = Math.floor(p.maxHp * 1.25)
      p.hp = p.maxHp
    }
    log('藏经阁中灵光乍现，秘法已入脑髓。', 'gold')
    set({
      player: p,
      sect: {
        ...sect,
        learned: [...sect.learned, libId],
        contribution: sect.contribution - cost,
      },
    })
  },

  promoteRank: () => {
    const { sect } = get()
    if (!sect.sectId) return
    const need = { disciple: 50, inner: 150, true: 400, elder: 999999 }
    const next = { disciple: 'inner', inner: 'true', true: 'elder', elder: 'elder' } as const
    const cost = need[sect.rank]
    if (sect.contribution < cost || sect.rank === 'elder') {
      log(sect.rank === 'elder' ? '已是长老。' : `晋升需贡献 ${cost}。`, 'dim')
      return
    }
    const rank = next[sect.rank]
    const label = { inner: '内门弟子', true: '真传弟子', elder: '长老' }[rank as string] ?? rank
    log(`宗门晋升：${label}`, 'gold')
    set({ sect: { ...sect, rank, contribution: sect.contribution - cost } })
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
    const { tower, player, sect, treasures, companion } = get()
    if (!tower || !player || !player.alive || tower.left) return
    const realm = SECRET_REALMS.find((r) => r.id === tower.realmId)
    if (!realm) return
    const boss = isBossFloor(realm, tower.floor)
    const enemy = towerEnemy(realm.id, tower.floor, boss)
    const hpScale = realm.env.playerHpMul ?? 1
    const pStats = makePlayerCombatant(player, sect.learned, treasures, hpScale)
    const spouse = spouseDef(companion)
    // 道侣助战：小幅加攻
    if (spouse) {
      pStats.atk = Math.floor(pStats.atk * 1.08)
    }
    const result = runCombat(pStats, enemy)
    const lines = [
      `秘境 ${realm.name} · 第${tower.floor}层${boss ? '（镇守）' : ''}`,
      ...result.rounds.map((r) => r.text),
      result.message,
    ]
    const inv = { ...get().inventory }

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
        lastCombat: { enemy, win: true, log: lines },
        towerBest: { ...get().towerBest, [realm.id]: best },
        tower: clearedAll
          ? { ...tower, left: true, log: lines, inCombat: false }
          : {
              ...tower,
              floor: tower.floor + 1,
              inCombat: false,
              log: lines,
            },
        player: {
          ...player,
          exp: player.exp + result.expGain,
          hp: result.playerHpLeft,
        },
      })
      if (clearedAll) {
        log(`你贯通了「${realm.name}」全部 ${realm.floors} 层！`, 'gold')
      }
      return
    }

    log(`秘境第 ${tower.floor} 层不敌，被迫退出。`, 'bad')
    set({
      lastCombat: { enemy, win: false, log: lines },
      tower: null,
      player: {
        ...player,
        hp: Math.max(1, Math.floor(result.playerHpLeft || player.maxHp * 0.12)),
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

    const base = cultivateGain(player.classId, player.realm, player.layer)
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
      localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(snapshotOf(get())))
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
      const snap = JSON.parse(raw) as SlotSnapshot
      if (!snap?.player) return false
      useLogStore.getState().clear()
      log(
        `读取存档位 ${slot}：${snap.player.name} · ${realmLabel(snap.player.realm, snap.player.layer)}`,
        'gold',
      )
      const c = CLASSES[snap.player.classId]
      const maxHp = Math.max(snap.player.maxHp, realmMaxHp(snap.player.realm, c.hpMul))
      const maxEnergy = Math.max(
        snap.player.maxEnergy,
        realmMaxEnergy(snap.player.realm, snap.player.classId === 'demon'),
      )
      const lifespanFloor = REALMS[snap.player.realm].lifespan
      set({
        phase: 'play',
        time: snap.time,
        player: {
          ...snap.player,
          maxHp,
          maxEnergy,
          hp: Math.min(snap.player.hp, maxHp),
          lifespanLeft: Math.max(snap.player.lifespanLeft, Math.floor(lifespanFloor * 0.3)),
        },
        stones: snap.stones,
        inventory: snap.inventory,
        sect: snap.sect ?? freshSect(),
        treasures: snap.treasures ?? [],
        companion: snap.companion ?? freshCompanion(),
        towerBest: snap.towerBest ?? {},
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
      const snap = JSON.parse(raw) as SlotSnapshot
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

  importSave: (json) => {
    try {
      const snap = JSON.parse(json) as SlotSnapshot
      if (!snap?.player?.name) return false
      set({
        phase: 'play',
        time: snap.time,
        player: snap.player,
        stones: snap.stones ?? 0,
        inventory: snap.inventory ?? {},
        sect: snap.sect ?? freshSect(),
        treasures: snap.treasures ?? [],
        companion: snap.companion ?? freshCompanion(),
        towerBest: snap.towerBest ?? {},
        tower: null,
        lastCombat: null,
        pendingEvent: null,
      })
      log('存档导入成功。', 'gold')
      return true
    } catch {
      return false
    }
  },
}))
