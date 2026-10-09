import { artifactDisplayName, makeArtifactUid, type ArtifactInstance } from '../../data/artifacts'
import { CLASSES } from '../../data/classes'
import { GONGFAS } from '../../data/gongfa'
import { itemCategory } from '../../data/items'
import { expNeeded, realmIndex } from '../../data/realms'
import { SECRET_REALMS } from '../../data/secretRealms'
import { advanceTime, dailyRecover, dayKey } from '../../game/day'
import { freshAbode } from '../../game/farm'
import { daoBonuses, isAscended, reincarnateGain } from '../../game/reincarnate'
import { saveGameSettings } from '../../game/settings'
import {
  afterProgressSnapshot,
  freshPlayer,
  log,
  processMetaProgress,
  recomputeVitals,
  unlockCodex,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import {
  defaultInventory,
  freshCompanion,
  freshGongfa,
  freshSect,
  mergeCollection,
} from '../saveMigrate'
import { useLogStore } from '../useLogStore'
import type { GongfaLearned, LegacyState } from '../../types'

/** meta 域：阶段/菜单/创角、设置项、推进天数、调试 actions */
export function createMetaSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'setPanel'
  | 'setSkipExploreCombat'
  | 'setAutoCombatDefault'
  | 'startCreate'
  | 'backToMenu'
  | 'createCharacter'
  | 'advanceDays'
  | 'debugAddExp'
  | 'debugFillExp'
  | 'debugUnlockTowerFloors'
  | 'recoverFull'
> {
  return {
    setPanel: (p) => set({ activePanel: p }),
    setSkipExploreCombat: (v) => {
      saveGameSettings({ skipExploreCombat: v, autoCombatDefault: get().autoCombatDefault })
      set({ skipExploreCombat: v })
      log(
        v
          ? '已开启：历练与秘境将跳过战斗，直接结算战报。'
          : '已关闭：历练与秘境将进入战斗面板手动出招。',
        'dim',
      )
    },
    setAutoCombatDefault: (v) => {
      saveGameSettings({ skipExploreCombat: get().skipExploreCombat, autoCombatDefault: v })
      set({ autoCombatDefault: v })
      log(v ? '已开启：新战斗默认托管自动出招。' : '已关闭：新战斗默认手动出招。', 'dim')
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
          if (itemCategory(s.id) === 'treasure') sealedTreasures.push(s.id)
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
        const np = get().player!
        const p2 = recomputeVitals(get, np, sealedTreasures, learned, legacy.daoMarks, np.realm)
        set({ player: p2 })
      }
      unlockCodex(get, set, 'realm', 'qi')
      processMetaProgress(get, set)
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

    debugAddExp: (n) => {
      const { player } = get()
      if (!player || !player.alive) return
      set({ player: { ...player, exp: Math.max(0, player.exp + Math.floor(n)) } })
      log(`调试：修为 +${Math.floor(n)}。`, 'dim')
    },
    debugFillExp: () => {
      const { player } = get()
      if (!player || !player.alive) return
      const need = expNeeded(player.realm, player.layer)
      set({ player: { ...player, exp: need } })
      log(`调试：修为已充满（${need}），可直接突破。`, 'dim')
    },
    debugUnlockTowerFloors: () => {
      const best = { ...get().towerBest }
      for (const r of SECRET_REALMS) best[r.id] = r.floors
      set({ towerBest: best })
      log('调试：全部秘境已解锁至最高层。', 'dim')
    },

    recoverFull: () => {
      const { player } = get()
      if (!player) return
      set({ player: { ...player, hp: player.maxHp, energy: player.maxEnergy } })
      log('灵力回满，气血充盈。', 'dim')
    },
  }
}
