import { companionById } from '../../data/companions'
import { bestBreakthroughPill, requiredMaterial, ITEMS } from '../../data/items'
import { expNeeded, REALMS, realmIndex } from '../../data/realms'
import {
  isTribulationMoment,
  softenSeverity,
  tribulationPlan,
} from '../../data/tribulation'
import { applyLayerDown, applyLayerUp, attemptBreakthrough, canBreakthrough } from '../../game/breakthrough'
import { breakthroughSuccessRate } from '../../game/rules/breakthrough'
import { gongfaBonuses, treasureBreakthroughTotal } from '../../game/combatStats'
import { clampWanted } from '../../game/bounty'
import {
  GAME_DAYS_PER_YEAR,
  advanceTime,
  dailyRecover,
  dayKey,
  dayNumber,
  weatherOf,
} from '../../game/day'
import { clamp } from '../../game/format'
import { removeItem } from '../../game/inventory'
import { daoBonuses, isAscended, reincarnateGain } from '../../game/reincarnate'
import { sealDaoCost, sealSlots, type SealedItem } from '../../game/seal'
import {
  afterProgressSnapshot,
  bumpDaily,
  cultivateMultipliers,
  currentRules,
  gainCultivate,
  gainSeclusion,
  log,
  maybeTriggerSpouseStory,
  pickEvent,
  recomputeVitals,
  sectDef,
  spouseDef,
  touchOnline,
  unlockCodex,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import type { LegacyState } from '../../types'

/** cultivate 域：打坐/闭关/突破（天劫方案）/双修/转生 */
export function createCultivateSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  'meditate' | 'seclude' | 'breakthrough' | 'reincarnate' | 'dualCultivate'
> {
  return {
    meditate: () => {
      const { player, time } = get()
      if (!player || !player.alive || isAscended(player) || get().pendingEvent || get().pendingStory || get().tower || get().activeCombat) return
      let gain = gainCultivate(player.classId, player.realm, player.layer, get().abode.julingLevel)
      gain = Math.floor(
        gain *
          cultivateMultipliers(
            player,
            get().sect,
            get().companion,
            get().gongfa.learned,
            get().legacy.daoMarks,
            get().treasures,
          ),
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
      bumpDaily(get, set, 'meditate')

      const evt = pickEvent(get)
      if (evt) set({ pendingEvent: { event: evt, kind: 'meditate' } })
      maybeTriggerSpouseStory(get, set)
    },

    seclude: (days) => {
      // 与游戏日历对齐：1 年 = 360 日；上限约百年 + 余量
      const n = clamp(days, 1, GAME_DAYS_PER_YEAR * 120)
      const { player, time } = get()
      if (!player || !player.alive || isAscended(player) || get().pendingEvent || get().pendingStory || get().tower || get().activeCombat) return
      let gain = gainSeclusion(player.classId, player.realm, player.layer, n, get().abode.julingLevel)
      gain = Math.floor(
        gain *
          cultivateMultipliers(
            player,
            get().sect,
            get().companion,
            get().gongfa.learned,
            get().legacy.daoMarks,
            get().treasures,
          ),
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
      // v1.4 闭关 ≥7 日：通缉降一档（风声渐息）
      let wantedNext = get().wanted
      if (n >= 7 && wantedNext > 0) {
        wantedNext = clampWanted(wantedNext - 1)
        log('闭关日久，风声渐息，通缉降了一档。', 'dim')
      }
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
        wanted: wantedNext,
      })
      touchOnline(get, set)

      const evt = pickEvent(get)
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
        removeItem(inv, usedPlan.costItemId, need)
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
      // 突破成功率规则集中在 game/rules/breakthrough：基础率 + 各加成线性叠加后钳制 5..95
      const rate = breakthroughSuccessRate({
        classId: player.classId,
        realm: player.realm,
        sectBonus: sdef?.bonus.breakthroughBonus ?? 0,
        spouseBonus,
        daoBonus: dao.breakthroughBonus,
        treasureBonus: treasureBt,
        pillBonus: pillBt,
        tribTokenBonus: tribTokenBt,
        synergyBonus: synBt,
        planRateDelta: usedPlan.rateDelta,
        rulesRateDelta: currentRules().breakthroughRateDelta,
      })
      const roll = Math.random() * 100
      // 成败与文案共用「含加成后的 rate」，避免成功却打出失败日志
      const result = attemptBreakthrough(player.classId, player.realm, player.layer, roll, rate)
      const success = result.success
      const need = expNeeded(player.realm, player.layer)

      // 冲击壁垒自动消耗一枚突破丹（无论成败；金丹护道方案除外）
      if (usedPlan.id !== 'golden_pill' && breakPill) {
        removeItem(inv, breakPill.id)
      }

      if (success) {
        const next = applyLayerUp(player.realm, player.layer)
        const justAscended = next.realm === 'ascended'
        if (isMajor && matId) {
          removeItem(inv, matId)
        }
        const vitals = recomputeVitals(
          get,
          { ...player, realm: next.realm, layer: next.layer },
          treasures,
          get().gongfa.learned,
          get().legacy.daoMarks,
          player.realm,
        )
        log(result.message, 'gold')
        if (usedPlan.id !== 'normal') log(`天劫方案：${usedPlan.name}`, 'gold')
        if (justAscended) {
          log('霞举飞升，超脱此界。仙缘初聚（+50），可在秘境寻访仙机；此世修行已圆满，也可随时转生。', 'gold')
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
          favor: justAscended ? get().favor + Math.floor(50 * currentRules().favorMul) : get().favor,
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

    reincarnate: (input, sealed = null) => {
      const { player, companion, legacy } = get()
      if (!player || (player.alive && !isAscended(player))) {
        log('此身尚在修行，无需转生。（需先飞升或道消）', 'dim')
        return
      }
      const gain = reincarnateGain(player, Boolean(companion.spouseId), get().favor)
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

      const base = gainCultivate(player.classId, player.realm, player.layer, get().abode.julingLevel)
      // 与打坐/闭关共用基础倍率（含法宝修炼加成），保留双修特殊系数 dualMul×2
      const gain = Math.floor(
        base *
          cultivateMultipliers(
            player,
            get().sect,
            get().companion,
            get().gongfa.learned,
            get().legacy.daoMarks,
            get().treasures,
          ) *
          c.dualMul *
          2,
      )
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
  }
}
