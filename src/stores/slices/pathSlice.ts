import { CLASSES, isDemonic, pathIdsOf, secondarySlots, usedSecondarySlots } from '../../data/classes'
import type { ClassId } from '../../types'
import {
  PRIMARY_SWITCH_LIFESPAN_PCT,
  PRIMARY_SWITCH_SECLUSION_DAYS,
  enshrinePath,
  pathCost,
  pathEnshrineText,
  pathUnlockStatus,
  primarySwitchCost,
  totalTowerFloors,
  type UnlockCtx,
} from '../../game/paths'
import { REALMS } from '../../data/realms'
import { advanceTime } from '../../game/day'
import { afterProgressSnapshot, recomputeVitals } from '../helpers'
import { log } from '../helpers/log'
import type { GameState, MetaGet, MetaSet } from '../gameState'

/** 立道判定所需的当前状态快照 */
export function pathUnlockCtx(get: MetaGet): UnlockCtx | null {
  const s = get()
  const p = s.player
  if (!p) return null
  return {
    realm: p.realm,
    layer: p.layer,
    stats: s.meta.stats,
    towerFloors: totalTowerFloors(s.towerBest),
    repDemonic: p.repDemonic,
    stones: s.stones,
    lifespanLeft: p.lifespanLeft,
    ownedPaths: pathIdsOf(p),
  }
}

/**
 * path 域：问道/立道（择道）与改立主修。
 *
 * 传统修仙写法：先行修仙，途中或师授、或历练顿悟、或百炼成技，才立下道途。
 * 首立之道为主修（全额），其后为兼修（半数加成），兼修位随境界扩张。
 */
export function createPathSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<GameState, 'choosePath' | 'setPrimaryPath'> {
  return {
    choosePath: (pathId) => {
      const s = get()
      const p = s.player
      if (!p || !p.alive) return
      const def = CLASSES[pathId]
      if (!def || pathId === 'none') return
      const ctx = pathUnlockCtx(get)
      if (!ctx) return
      const status = pathUnlockStatus(def, ctx)
      if (status.owned) {
        log(`你已立「${def.name}」，不必再问。`, 'dim')
        return
      }
      if (!status.ok) {
        log(`问道未成：${status.missing.join('；')}。`, 'bad')
        return
      }
      const cost = pathCost(def)
      const nextStones = s.stones - cost.stones
      if (p.lifespanLeft - cost.lifespan <= 0) {
        log('立道需以寿元为引，而你已油尽灯枯。', 'bad')
        return
      }
      // 立道结算走唯一纯函数（R-21：师承入口共用）
      const { player: nextPlayer, isPrimary } = enshrinePath(p, def)
      log(pathEnshrineText(def, isPrimary), 'gold')
      if (cost.stones > 0) log(`立道之资：灵石 -${cost.stones}。`, 'dim')
      if (cost.lifespan > 0) log(`以寿元为引：寿元 -${cost.lifespan} 年。`, 'dim')
      if (cost.repRight > 0) {
        log(
          `血誓既立，正道声望 -${cost.repRight}。自此正道宗门、坊市皆视你为魔道中人。`,
          'bad',
        )
      }
      const hdGained = (nextPlayer.heartDemon ?? 0) - (p.heartDemon ?? 0)
      if (hdGained > 0) {
        log(`禁忌之道祸根暗种，心魔初生（心魔 +${hdGained}，现 ${nextPlayer.heartDemon}）。此道不占兼修位。`, 'bad')
      }
      const vitals = recomputeVitals(
        get,
        nextPlayer,
        s.treasures,
        s.gongfa.learned,
        s.legacy.daoMarks,
        p.realm,
      )
      set({
        player: {
          ...vitals,
          // 立魔道：煞气随血誓而生
          shaqi: isDemonic(nextPlayer) ? Math.max(p.shaqi, 10) : p.shaqi,
        },
        stones: Math.max(0, nextStones),
      })
      if (!isPrimary) {
        const used = usedSecondarySlots(nextPlayer)
        const slots = secondarySlots(p.realm)
        log(`兼修位已用 ${used}/${slots}：兼修只得半数加成，且分心拖慢修炼。`, 'dim')
      } else {
        log('首立之道即为你的主修。日后境界渐高，另立之道皆为兼修。', 'dim')
      }
      afterProgressSnapshot(get, set)
    },

    setPrimaryPath: (pathId) => {
      const s = get()
      const p = s.player
      if (!p || !p.alive) return
      const ids = pathIdsOf(p)
      if (!ids.includes(pathId)) {
        log('尚未立下此道，无从改立主修。', 'dim')
        return
      }
      if (p.classId === pathId) {
        log(`「${CLASSES[pathId]?.name ?? pathId}」已是你的主修。`, 'dim')
        return
      }
      const cost = primarySwitchCost(p.realm)
      if (s.stones < cost) {
        log(`改立主修需洗炼道基，灵石不足（需 ${cost}）。`, 'bad')
        return
      }
      // R-25：转主修有叙事代价——洗炼道基伤及根本，折损寿元，且须闭门重修
      const lifespanCost = Math.floor(REALMS[p.realm].lifespan * PRIMARY_SWITCH_LIFESPAN_PCT)
      const nextLifespan = Math.max(1, p.lifespanLeft - lifespanCost)
      if (p.lifespanLeft - lifespanCost <= 0) {
        log('洗炼道基需以寿元为引，而你已油尽灯枯。', 'bad')
        return
      }
      const rest = ids.filter((id) => id !== pathId)
      const nextPlayer = {
        ...p,
        classId: pathId as ClassId,
        paths: rest.filter((id) => id !== pathId),
        lifespanLeft: nextLifespan,
      }
      const advanced = advanceTime(s.time, PRIMARY_SWITCH_SECLUSION_DAYS)
      log(
        `你洗去旧日印记，改以「${CLASSES[pathId]?.name ?? pathId}」为主修（灵石 -${cost}，寿元 -${lifespanCost} 年）。`,
        'gold',
      )
      log(`洗炼道基伤及根本，你闭门静养 ${PRIMARY_SWITCH_SECLUSION_DAYS} 日，方将新道根基稳住。`, 'dim')
      set({
        stones: s.stones - cost,
        time: advanced.time,
        player: recomputeVitals(
          get,
          nextPlayer,
          s.treasures,
          s.gongfa.learned,
          s.legacy.daoMarks,
          p.realm,
        ),
      })
    },
  }
}
