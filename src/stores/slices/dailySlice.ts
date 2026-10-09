import {
  CHECKIN_REWARDS,
  DAILY_ALL_CLEAR_STONE_MUL,
  DAILY_TASK_MAP,
  WEEK_GIFT,
  dailyExpReward,
  dailyStoneReward,
  pillForRealm,
} from '../../data/daily'
import { ITEMS } from '../../data/items'
import { addItem } from '../../game/inventory'
import { checkinOutcome, dailyAllClaimed, realDayKey } from '../../game/daily'
import { isAscended } from '../../game/reincarnate'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import { currentRules, log } from '../helpers'
import { ensureDailyState } from '../helpers/daily'

/** 飞升后日课不发修为，改发仙缘（单条 5–15，再乘 favorMul） */
function ascendedFavorGain(favorMul: number): number {
  return Math.floor((5 + Math.floor(Math.random() * 11)) * favorMul)
}

/** daily 域：日课领取 / 周礼包 / 现实日签到 */
export function createDailySlice(
  set: MetaSet,
  get: MetaGet,
): Pick<GameState, 'ensureDaily' | 'claimDailyTask' | 'claimDailyWeekGift' | 'claimCheckin'> {
  return {
    ensureDaily: () => ensureDailyState(get, set),

    claimDailyTask: (id) => {
      const s = get()
      if (!s.player || !s.player.alive) return
      ensureDailyState(get, set)
      const d = get().daily
      const task = d.tasks.find((t) => t.id === id)
      if (!task || task.claimed) return
      const def = DAILY_TASK_MAP[id]
      if (!def || task.progress < def.target) {
        log('日课尚未完成。', 'dim')
        return
      }
      const player = get().player!
      const asc = isAscended(player)
      const rules = currentRules()
      const stone = Math.floor(dailyStoneReward() * rules.dailyRewardMul)
      const exp = asc ? 0 : dailyExpReward(player.realm, player.layer)
      const favorGain = asc ? ascendedFavorGain(rules.favorMul) : 0
      const tasks = d.tasks.map((t) => (t.id === id ? { ...t, claimed: true } : t))
      let points = d.points
      let bonusStone = 0
      if (dailyAllClaimed(tasks)) {
        points += 1
        bonusStone = stone * DAILY_ALL_CLEAR_STONE_MUL
        log(`今日日课全部完成！灵石 +${bonusStone}，日课积分 +1（${points}/${WEEK_GIFT.points}）`, 'gold')
      }
      log(
        `日课「${def.desc}」完成：灵石 +${stone}${exp > 0 ? `，修为 +${exp}` : ''}${favorGain > 0 ? `，仙缘 +${favorGain}` : ''}`,
        'good',
      )
      set({
        daily: { ...d, tasks, points },
        stones: get().stones + stone + bonusStone,
        favor: get().favor + favorGain,
        player: { ...player, exp: player.exp + exp },
      })
    },

    claimDailyWeekGift: () => {
      const s = get()
      if (!s.player || !s.player.alive) return
      const d = s.daily
      if (d.points < WEEK_GIFT.points) {
        log(`日课积分不足（${d.points}/${WEEK_GIFT.points}）。`, 'dim')
        return
      }
      const player = s.player
      const inv = { ...s.inventory }
      const asc = isAscended(player)
      const favorMul = currentRules().favorMul
      const exp = asc ? 0 : dailyExpReward(player.realm, player.layer, WEEK_GIFT.expPctOfNeed)
      const favorGain = asc ? Math.floor(30 * favorMul) : 0
      const pillId = pillForRealm(player.realm)
      let pillName = ''
      if (pillId) {
        addItem(inv, pillId, 1)
        pillName = ITEMS[pillId]?.name ?? pillId
      }
      log(
        `周礼包：灵石 +${WEEK_GIFT.stones}${exp > 0 ? `，修为 +${exp}` : ''}${favorGain > 0 ? `，仙缘 +${favorGain}` : ''}${pillName ? `，「${pillName}」×1` : ''}`,
        'gold',
      )
      set({
        daily: { ...d, points: d.points - WEEK_GIFT.points },
        stones: s.stones + WEEK_GIFT.stones,
        inventory: inv,
        favor: s.favor + favorGain,
        player: { ...player, exp: player.exp + exp },
      })
    },

    claimCheckin: () => {
      const s = get()
      if (!s.player || !s.player.alive) return
      const today = realDayKey()
      const oc = checkinOutcome(s.checkin.lastDate, s.checkin.streak, today)
      if (!oc) {
        log('今日已签到。', 'dim')
        return
      }
      const reward = CHECKIN_REWARDS.find((r) => r.day === oc.day)
      const inv = { ...s.inventory }
      const player = s.player
      const asc = isAscended(player)
      let stones = s.stones
      let exp = 0
      let favorGain = 0
      const parts: string[] = []
      if (reward) {
        if (reward.stones) {
          stones += reward.stones
          parts.push(`灵石 +${reward.stones}`)
        }
        if (reward.expPctOfNeed) {
          if (asc) {
            favorGain += Math.floor(10 * currentRules().favorMul)
            parts.push('仙缘 +' + favorGain)
          } else {
            exp = dailyExpReward(player.realm, player.layer, reward.expPctOfNeed)
            if (exp > 0) parts.push(`修为 +${exp}`)
          }
        }
        if (reward.itemId && reward.count) {
          addItem(inv, reward.itemId, reward.count)
          parts.push(`${ITEMS[reward.itemId]?.name ?? reward.itemId} ×${reward.count}`)
        }
        if (reward.pillGradePick) {
          const pillId = pillForRealm(player.realm)
          if (pillId) {
            addItem(inv, pillId, 1)
            parts.push(`${ITEMS[pillId]?.name ?? pillId} ×1`)
          }
        }
      }
      log(`签到第 ${oc.day} 天（连签 ${oc.streak} 天）：${parts.join('，') || '心意已领'}`, 'gold')
      set({
        checkin: { lastDate: today, streak: oc.streak },
        stones,
        inventory: inv,
        favor: s.favor + favorGain,
        player: { ...player, exp: player.exp + exp },
      })
    },
  }
}
