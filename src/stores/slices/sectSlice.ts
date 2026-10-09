import { GONGFAS, canLearnGongfaFull, gongfaRealmText, gongfaScopeText } from '../../data/gongfa'
import { ITEMS } from '../../data/items'
import { realmIndex, realmLabel } from '../../data/realms'
import {
  SECT_RANKS,
  SECTS,
  nextSectRank,
  sectExamOpponent,
  sectRankIndex,
} from '../../data/sects'
import {
  SECT_BUILDING_MAP,
  buildingLevel,
  buildingUpgradeCost,
  commissionPoolCutOf,
  stonesToPool,
} from '../../data/sectBuildings'
import { availableQuestChains, questChainById, questStepMatchesDeliver } from '../../data/sectQuests'
import { createCombatState } from '../../game/combatEngine'
import { advanceTime } from '../../game/day'
import { addItem, removeItem } from '../../game/inventory'
import { isAscended } from '../../game/reincarnate'
import { playBell, playChime } from '../../game/sfx'
import {
  afterProgressSnapshot,
  log,
  makePlayerCombatant,
  recomputeVitals,
  unlockCodex,
  withPetCombat,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import { freshSect } from '../saveMigrate'

/** sect 域：入宗/宗门任务/委托/贡献池/建设/大比晋升/藏经残页 */
export function createSectSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'joinSect'
  | 'leaveSect'
  | 'sectTask'
  | 'sectExchange'
  | 'sectLearn'
  | 'sectGrandCompetition'
  | 'promoteRank'
  | 'acceptQuestChain'
  | 'advanceQuestStep'
  | 'abandonQuestChain'
  | 'upgradeSectBuilding'
  | 'donateToPool'
  | 'allocateToPool'
  | 'upgradeSectBuildingYard'
  | 'proposeSectBuilding'
  | 'redeemSectFragment'
> {
  return {
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
      addItem(inv, itemId)
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
      const p = recomputeVitals(get, { ...player }, treasures, learned, legacy.daoMarks, player.realm)
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
      const actor = makePlayerCombatant(get, player, treasures, 1)
      const state = createCombatState(actor, enemy, withPetCombat({ kind: 'sect_exam', title: `宗门大比 · ${next.name}晋升考核`, enemy, hpScale: 1 }, get().pet))
      set({
        activeCombat: state,
        autoCombat: get().autoCombatDefault,
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
          addItem(inv, 'sect_fragment')
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
        removeItem(inv, match.itemId, need)
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
      removeItem(inv, 'sect_fragment', 3)
      const learned = { ...gongfa.learned, [pick.id]: { stage: 0 } }
      const p = recomputeVitals(get, { ...player }, treasures, learned, legacy.daoMarks, player.realm)
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
  }
}
