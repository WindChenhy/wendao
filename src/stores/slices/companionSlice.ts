import { SEED_LIST, SEEDS } from '../../data/abode'
import {
  CHAT_AFFINITY_DAILY_LIMIT,
  CROSS_ALIGNMENT_AFFINITY_EXTRA,
  GIFT_DAILY_LIMIT,
  MARRY_STONES_COST,
  SWORN_STONES_COST,
  companionById,
  giftAffinity,
  storyEndingKey,
  type StoryChoice,
} from '../../data/companions'
import { isDemonic } from '../../data/classes'
import { ITEMS } from '../../data/items'
import { dayNumber } from '../../game/day'
import { harvestYield, plotProgress } from '../../game/farm'
import { addItem, removeItem } from '../../game/inventory'
import { isCrossAlignment } from '../../game/reputation'
import {
  afterProgressSnapshot,
  log,
  maybeTriggerSpouseStory,
  unlockCodex,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import type { CompanionState } from '../../types'
import { uniqIds } from '../saveMigrate'

/** companion 域：道侣闲谈/赠礼/结缘/结缘后剧情/代劳 */

/** 当日互动计数（跨日自动清零） */
function interactOf(
  companion: CompanionState,
  id: string,
  key: string,
): { chat: number; gift: number } {
  const rec = companion.dailyInteract?.[id]
  return rec && rec.day === key ? { chat: rec.chat, gift: rec.gift } : { chat: 0, gift: 0 }
}

function bumpInteract(
  companion: CompanionState,
  id: string,
  key: string,
  field: 'chat' | 'gift',
): Record<string, { day: string; chat: number; gift: number }> {
  const cur = interactOf(companion, id, key)
  return {
    ...companion.dailyInteract,
    [id]: { day: key, ...cur, [field]: cur[field] + 1 },
  }
}
export function createCompanionSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'chatCompanion'
  | 'giftCompanion'
  | 'resolveStory'
  | 'triggerSpouseStory'
  | 'spouseFarmHelp'
  | 'spousePillHelp'
  | 'propose'
> {
  return {
    chatCompanion: (id) => {
      const { companion, player, time } = get()
      if (!player || !player.alive) return
      const c = companionById(id)
      if (!c) return
      const key = `${time.year}-${time.month}-${time.day}`
      const { chat } = interactOf(companion, id, key)
      if (chat >= CHAT_AFFINITY_DAILY_LIMIT) {
        log(`与${c.name}闲谈片刻。今日已叙过多次，好感不再增加。`, 'dim')
        return
      }
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
          dailyInteract: bumpInteract(companion, id, key, 'chat'),
        },
      })
      if (next >= 1) unlockCodex(get, set, 'companion', id)
      if (heartTexts.length > 0) afterProgressSnapshot(get, set)
    },

    giftCompanion: (id, itemId) => {
      const { companion, inventory, player, time } = get()
      if (!player) return
      const c = companionById(id)
      if (!c) return
      if ((inventory[itemId] ?? 0) <= 0) {
        log('背包中没有此物。', 'bad')
        return
      }
      const key = `${time.year}-${time.month}-${time.day}`
      const { gift } = interactOf(companion, id, key)
      if (gift >= GIFT_DAILY_LIMIT) {
        log(`${c.name}摆手：「今日已收下两份心意，再收便要折福了。」`, 'bad')
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
      const inv = { ...inventory }
      removeItem(inv, itemId)
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
          dailyInteract: bumpInteract(companion, id, key, 'gift'),
        },
      })
      if (next >= 1) unlockCodex(get, set, 'companion', id)
      if (heartTexts.length > 0) afterProgressSnapshot(get, set)
    },

    resolveStory: (choiceId) => {
      const { pendingStory, companion, player, stones, legacy, inventory } = get()
      if (!pendingStory || !player) {
        set({ pendingStory: null })
        return
      }
      const { companionId, beat, beatIndex } = pendingStory
      const choice: StoryChoice | undefined = beat.choices?.find((c) => c.id === choiceId)
      // v1.5：postStage 必须按被选中的段落下标推进（门槛可能跳过若干段）
      const stage = beatIndex ?? companion.postStage[companionId] ?? 0
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
      if (choice?.itemId) addItem(nextInv, choice.itemId)
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

    triggerSpouseStory: (id) => {
      maybeTriggerSpouseStory(get, set, id)
      if (!get().pendingStory) {
        log('眼下无新的缘法可续。', 'dim')
      }
    },

    spouseFarmHelp: () => {
      const { companion, player, time, abode, inventory } = get()
      if (!player || !player.alive || companion.spouseIds.length === 0) return
      if ((companion.spouseHurtUntilDay ?? 0) > dayNumber(time)) {
        log('道侣重伤未愈，无法代劳。', 'bad')
        return
      }
      const key = `${time.year}-${time.month}-${time.day}`
      if (companion.farmHelpOn === key) {
        log('今日道侣已代为打理过灵田。', 'dim')
        return
      }
      const c = companionById(companion.spouseIds[0]!)
      if (!c) return
      let inv = { ...inventory }
      let harvested = 0
      const plots = abode.plots.map((plot) => {
        const prog = plotProgress(plot, time)
        if (!plot.seedId || !prog.ready) return plot
        const seed = SEEDS[plot.seedId]
        if (!seed) return { seedId: null, plantedDay: 0 }
        const n = harvestYield(plot.seedId) + 1 + Math.floor(Math.random() * 2)
        addItem(inv, seed.yieldItemId, n)
        harvested += n
        return { seedId: null, plantedDay: 0 }
      })
      // 自动补种
      let replanted = 0
      const finalPlots = plots.map((plot) => {
        if (plot.seedId) return plot
        for (const s of SEED_LIST) {
          if ((inv[s.id] ?? 0) > 0) {
            removeItem(inv, s.id)
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
      if (!player || !player.alive || companion.spouseIds.length === 0) return
      if ((companion.spouseHurtUntilDay ?? 0) > dayNumber(time)) {
        log('道侣重伤未愈，无法代炼。', 'bad')
        return
      }
      const key = `${time.year}-${time.month}-${time.day}`
      if (companion.pillHelpOn === key) {
        log('今日道侣已代炼过丹药。', 'dim')
        return
      }
      const c = companionById(companion.spouseIds[0]!)
      if (!c) return
      const inv = { ...inventory }
      // 苏青/玄灵炼丹更佳
      const skilled = c.id === 'su_qing' || c.id === 'xuan_ling'
      const healN = skilled ? 2 : 1
      const qiN = skilled ? 1 : 0
      addItem(inv, 'pill_heal', healN)
      if (qiN) addItem(inv, 'pill_qi', qiN)
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

    propose: (id) => {
      const { companion, player, stones } = get()
      if (!player) return
      const c = companionById(id)
      if (!c) return
      const aff = companion.affinity[id] ?? 0
      const bonded = [...companion.spouseIds, ...companion.swornIds]
      if (bonded.includes(id)) {
        log(`你们已有结缘，不必再提。`)
        return
      }
      if (aff < c.marryAt) {
        log(`${c.name}：「再相处些时日吧。」（需好感 ${c.marryAt}，当前 ${aff}）`, 'bad')
        return
      }
      // 正魔恋需更高好感（marryAt 之上再加一笔固定门槛）
      const isCross = isCrossAlignment(isDemonic(player), c.align)
      const crossNeed = c.marryAt + CROSS_ALIGNMENT_AFFINITY_EXTRA
      if (isCross && aff < crossNeed) {
        log(`正魔之恋阻力极大，${c.name}还需更多坚定。（需好感 ${crossNeed}）`, 'bad')
        return
      }
      if (c.gender === 'female') {
        // 女性：结为道侣（可有多位道侣）
        if (stones < MARRY_STONES_COST) {
          log(`结缘需置办双修洞府与礼数，灵石不足 ${MARRY_STONES_COST}。`, 'bad')
          return
        }
        log(`${c.name}应允了。自此结为道侣，祸福与共。`, 'gold')
        set({
          stones: stones - MARRY_STONES_COST,
          companion: {
            ...companion,
            spouseIds: [...companion.spouseIds, id],
            postStage: { ...companion.postStage, [id]: companion.postStage[id] ?? 0 },
          },
        })
      } else {
        // 男性：结拜为异姓兄弟
        if (stones < SWORN_STONES_COST) {
          log(`义结金兰需置办酒礼，灵石不足 ${SWORN_STONES_COST}。`, 'bad')
          return
        }
        log(c.swornText ?? `${c.name}与你焚香歃血，结为异姓兄弟。`, 'gold')
        log(`${c.name}大笑三声，与你义结金兰。此后祸福同担，护法同行。`, 'good')
        set({
          stones: stones - SWORN_STONES_COST,
          companion: { ...companion, swornIds: [...companion.swornIds, id] },
        })
      }
      unlockCodex(get, set, 'companion', id)
      afterProgressSnapshot(get, set)
      maybeTriggerSpouseStory(get, set, id)
    },
  }
}
