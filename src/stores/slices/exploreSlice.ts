import {
  ENEMIES,
  enemyTemplateId,
  pickEnemy,
} from '../../data/enemies'
import { ITEMS, itemCategory } from '../../data/items'
import {
  PET_CAPTURE_PITY,
  PET_GUARD_LOSS_REDUCE,
  PET_MAP,
  type PetState,
} from '../../data/pets'
import { realmIndex } from '../../data/realms'
import { canEnterRealm, isBossFloor, towerEnemy, SECRET_REALMS } from '../../data/secretRealms'
import type { EventOutcome, WorldEventAction } from '../../data/events'
import {
  createCombatState,
  defaultAutoAction,
  runCombatAuto,
  type CombatEngineState,
} from '../../game/combatEngine'
import { repDeltaOnKill } from '../../game/combatStats'
import { advanceTime, dailyRecover, dayNumber } from '../../game/day'
import { addItem, removeItem } from '../../game/inventory'
import { isAscended } from '../../game/reincarnate'
import {
  afterProgressSnapshot,
  applyCombatConsumables,
  log,
  makePlayerCombatant,
  recomputeVitals,
  spouseDef,
  startEngineCombat,
  unlockCodex,
  withPetCombat,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import { uniqIds } from '../saveMigrate'

/** explore 域：历练/奇遇 resolveEvent/秘境爬塔/lastCombat */
export function createExploreSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'explore'
  | 'clearCombat'
  | 'resolveEvent'
  | 'enterTower'
  | 'towerFight'
  | 'towerRest'
  | 'towerLeave'
> {
  return {
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
            removeItem(inv, id, n)
          }
        }
      }

      const applySettleOutcome = (oc: EventOutcome | undefined, fallbackText: string) => {
        let p = { ...player }
        let stonesAfter = stones - (action?.cost?.stones ?? 0) + (oc?.stones ?? 0)
        let contrib = sect.contribution - (action?.cost?.contribution ?? 0) + (oc?.contribution ?? 0)
        let pool = sect.pool + (oc?.pool ?? 0)
        let flags = [...companion.flags]
        let hidden = [...companion.hiddenUnlocked]
        let nextInv = { ...inv }
        if (oc?.itemId) {
          addItem(nextInv, oc.itemId)
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
          stones: Math.max(0, stonesAfter),
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
        const actor = makePlayerCombatant(get, player, treasures, 1)
        const label = '奇遇战斗'
        const result = runCombatAuto(
          actor,
          enemy,
          withPetCombat(
            {
              kind: 'event',
              title: `${label}：${evt.title}`,
              enemy,
              hpScale: 1,
            },
            get().pet,
          ),
          inv,
          player.realm,
          player.layer,
          (combatState) => defaultAutoAction(combatState, inv, player.realm, player.layer),
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
            addItem(inv, dropId)
          }
          const rep = repDeltaOnKill(enemy)
          log(`${label}获胜：${enemy.name}`, 'gold')
          const extra = win
          if (extra?.text) log(extra.text, 'gold')
          const metaEvt = get().meta
          let flags = [...get().companion.flags]
          if (extra?.flag && !flags.includes(extra.flag)) flags.push(extra.flag)
          const nextInv = { ...inv }
          if (extra?.itemId) addItem(nextInv, extra.itemId)
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
          if (extra?.itemId) addItem(nextInv, extra.itemId)
          let legacyNext = legacy
          if (extra?.daoMarks) {
            legacyNext = { ...legacy, daoMarks: legacy.daoMarks + extra.daoMarks }
          }
          const hpFloor = extra?.hpPct
            ? Math.max(1, player.hp - Math.floor(player.maxHp * extra.hpPct))
            : Math.max(1, Math.floor(player.maxHp * 0.15))
          // 看家灵兽减损（与历练失败同规则）
          const guardReduce = get().pet?.job === 'guard' ? PET_GUARD_LOSS_REDUCE : 0
          const stoneLoss = Math.ceil(20 * (1 - guardReduce))
          set({
            pendingEvent: null,
            inventory: nextInv,
            lastCombat: { enemy, win: false, log: lines },
            legacy: legacyNext,
            stones: Math.max(0, get().stones - stoneLoss - costStones + (extra?.stones ?? 0)),
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

      const settleUnlockPet = (oc: EventOutcome) => {
        const petId = oc.petId as string
        const def = PET_MAP[petId]
        const costStones = action?.cost?.stones ?? 0
        const costContrib = action?.cost?.contribution ?? 0
        const payCost = () =>
          set({
            pendingEvent: null,
            stones: Math.max(0, stones - costStones),
            sect: { ...sect, contribution: Math.max(0, sect.contribution - costContrib) },
          })
        if (!def) {
          payCost()
          return
        }
        // 已有灵兽：数据门槛应拦截，这里兜底防止覆盖
        if (get().pet) {
          log('你已有灵兽相伴，缘分就此别过。', 'dim')
          payCost()
          return
        }
        const fails = get().petCaptureFails
        if (oc.captureRate != null) {
          const guaranteed = fails >= PET_CAPTURE_PITY
          if (!guaranteed && Math.random() >= oc.captureRate) {
            log(oc.failText ?? '小兽挣脱，跑掉了。', 'bad')
            if (fails + 1 >= PET_CAPTURE_PITY) {
              log('机缘已熟——下次安抚或捕捉，必有灵兽回应。', 'gold')
            }
            set({
              pendingEvent: null,
              stones: Math.max(0, stones - costStones),
              sect: { ...sect, contribution: Math.max(0, sect.contribution - costContrib) },
              petCaptureFails: fails + 1,
            })
            return
          }
        }
        const next: PetState = {
          petId,
          name: def.name,
          level: 1,
          exp: 0,
          bond: 10,
          job: 'none',
          jobOn: '',
          restUntilDay: 0,
          captureFails: 0,
          broken: false,
          fight: true,
        }
        const flags = [...get().companion.flags]
        if (!flags.includes('has_pet')) flags.push('has_pet')
        let p = { ...player }
        if (oc.exp) p.exp += oc.exp
        const nextInv = { ...inv }
        if (oc.itemId) addItem(nextInv, oc.itemId)
        log(oc.text ?? `灵兽认主：${def.name}。`, 'gold')
        set({
          pendingEvent: null,
          inventory: nextInv,
          stones: Math.max(0, stones - costStones + (oc.stones ?? 0)),
          sect: {
            ...sect,
            contribution: Math.max(0, sect.contribution - costContrib + (oc.contribution ?? 0)),
            pool: Math.max(0, sect.pool + (oc.pool ?? 0)),
          },
          pet: next,
          petCaptureFails: 0,
          companion: { ...get().companion, flags: uniqIds(flags) },
          player: p,
        })
        afterProgressSnapshot(get, set)
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
        if (oc.kind === 'unlock_pet' && oc.petId) {
          settleUnlockPet(oc)
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
          addItem(inv, evt.payload.itemId)
          const isTreasure = itemCategory(evt.payload.itemId) === 'treasure'
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
            set({
              player: recomputeVitals(
                get,
                get().player!,
                t,
                get().gongfa.learned,
                get().legacy.daoMarks,
                get().player!.realm,
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
      const actor = makePlayerCombatant(get, player, treasures, hpScale)
      const spouse = spouseDef(companion)
      const spouseHurt = (companion.spouseHurtUntilDay ?? 0) > dayNumber(get().time)
      if (spouse && !spouseHurt) actor.atk = Math.floor(actor.atk * 1.08)
      const state = createCombatState(actor, enemy, withPetCombat({
        kind: 'tower',
        title: `秘境 ${realm.name} · 第${tower.floor}层${boss ? '（镇守）' : ''}`,
        enemy,
        hpScale,
      }, get().pet))
      set({
        activeCombat: state,
        autoCombat: get().autoCombatDefault,
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
  }
}
