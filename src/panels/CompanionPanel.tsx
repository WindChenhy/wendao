import {
  CHAT_AFFINITY_DAILY_LIMIT,
  COMPANIONS,
  DUAL_CULTIVATE_AFFINITY_MIN,
  GIFT_DAILY_LIMIT,
  MARRY_STONES_COST,
  SWORN_STONES_COST,
  companionById,
  nextStoryBeat,
  storyEndingLabel,
  type CompanionDef,
} from '../data/companions'
import { isDemonic } from '../data/classes'
import { ITEMS, itemCategory } from '../data/items'
import { isCrossAlignment } from '../game/reputation'
import { useGameStore } from '../stores/useGameStore'

export function CompanionPanel() {
  const player = useGameStore((s) => s.player)
  const companion = useGameStore((s) => s.companion)
  const inventory = useGameStore((s) => s.inventory)
  const chatCompanion = useGameStore((s) => s.chatCompanion)
  const giftCompanion = useGameStore((s) => s.giftCompanion)
  const dualCultivate = useGameStore((s) => s.dualCultivate)
  const propose = useGameStore((s) => s.propose)
  const triggerSpouseStory = useGameStore((s) => s.triggerSpouseStory)
  const spouseFarmHelp = useGameStore((s) => s.spouseFarmHelp)
  const spousePillHelp = useGameStore((s) => s.spousePillHelp)
  const time = useGameStore((s) => s.time)
  const sect = useGameStore((s) => s.sect)

  if (!player) return null
  const dead = !player.alive
  const dayKey = `${time.year}-${time.month}-${time.day}`
  const giftCandidates = Object.entries(inventory).filter(
    ([id, n]) => n > 0 && itemCategory(id) !== 'treasure' && ITEMS[id],
  )
  const unlockedSet = new Set(companion.hiddenUnlocked)
  const interactOf = (id: string) => {
    const rec = companion.dailyInteract?.[id]
    return rec && rec.day === dayKey ? rec : { day: dayKey, chat: 0, gift: 0 }
  }
  const spouses = companion.spouseIds
    .map(companionById)
    .filter((c): c is CompanionDef => Boolean(c))
  const sworn = companion.swornIds
    .map(companionById)
    .filter((c): c is CompanionDef => Boolean(c))

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {spouses.map((spouse) => {
        const storyBeat = nextStoryBeat(spouse, companion.postStage[spouse.id] ?? 0, {
          realm: player.realm,
          sectId: sect.sectId,
          sectRank: sect.rank,
          flags: companion.flags,
        }).beat
        return (
          <div key={spouse.id} className="panel-box p-4 border-gold">
            <div className="font-display text-gold text-lg">道侣 · {spouse.name}</div>
            <p className="text-xs text-text-dim mt-1">{spouse.title}</p>
            <p className="text-sm text-jade mt-2">
              双修加成 ×{spouse.dualMul} · 突破护法{' '}
              {spouse.breakthroughBonus >= 0 ? '+' : ''}
              {spouse.breakthroughBonus}% · 日常修炼亦有增益
            </p>
            {spouse.postStory && spouse.postStory.length > 0 && (
              <div className="mt-3 border-t border-border/50 pt-3 space-y-2">
                <div className="text-xs text-text-dim">
                  结缘长线：第 {(companion.postStage[spouse.id] ?? 0) + (storyBeat ? 1 : 0)}/
                  {spouse.postStory.length} 幕
                  {Object.entries(companion.endings)
                    .filter(([k]) => k.startsWith(`${spouse.id}_`))
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className={`ml-2 ${v === 'he' ? 'text-bamboo' : 'text-vermilion'}`}
                      >
                        已结{storyEndingLabel(v)}
                      </span>
                    ))}
                </div>
                {storyBeat ? (
                  <button
                    className="pixel-btn primary text-xs"
                    disabled={dead}
                    onClick={() => triggerSpouseStory(spouse.id)}
                  >
                    共叙前缘 · {storyBeat.title}
                  </button>
                ) : (
                  <div className="text-xs text-text-dim">缘线已尽，或已到结局。</div>
                )}
              </div>
            )}
            {(!spouse.postStory || spouse.postStory.length === 0) && (
              <div className="mt-3 border-t border-border/50 pt-3 text-xs text-text-dim">
                与你结为道侣，祸福与共。
              </div>
            )}
          </div>
        )
      })}

      {spouses.length > 0 && (
        <div className="panel-box p-4">
          <div className="text-xs text-text-dim mb-2">道侣日常（每日各一次）</div>
          <div className="flex flex-wrap gap-2">
            <button
              className="pixel-btn text-xs"
              disabled={dead || companion.farmHelpOn === dayKey}
              onClick={spouseFarmHelp}
            >
              托付灵田
              {companion.farmHelpOn === dayKey ? '（今日已托）' : ''}
            </button>
            <button
              className="pixel-btn text-xs"
              disabled={dead || companion.pillHelpOn === dayKey}
              onClick={spousePillHelp}
            >
              代炼低阶丹
              {companion.pillHelpOn === dayKey ? '（今日已炼）' : ''}
            </button>
          </div>
        </div>
      )}

      {sworn.length > 0 && (
        <div className="panel-box p-4 space-y-3">
          <div className="font-display text-gold">结拜兄弟</div>
          {sworn.map((c) => (
            <div key={c.id} className="border-t border-border/50 pt-2">
              <div className="text-sm text-gold">
                {c.name}
                <span className="text-xs text-text-dim ml-2">{c.title}</span>
              </div>
              <p className="text-xs text-text-dim mt-1 leading-relaxed">
                {c.swornText ?? '焚香歃血，义结金兰，护法同行。'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">红尘缘法</div>
        <p className="text-xs text-text-dim leading-relaxed">
          赠礼、闲谈可增好感：每人每日闲谈前 {CHAT_AFFINITY_DAILY_LIMIT} 次加好感，收礼至多{' '}
          {GIFT_DAILY_LIMIT} 次，再多便婉拒。达阈值触发心事件。女性可结为道侣（可有多位），男性则义结金兰、结拜为兄弟。正魔之恋阻力更大。结缘后另有长线剧情，抉择会进入图鉴结局。
        </p>
      </div>

      <div className="space-y-2">
        {COMPANIONS.map((c) => {
          const lockedHidden = Boolean(c.hidden) && !unlockedSet.has(c.id)
          const aff = companion.affinity[c.id] ?? 0
          const seen = companion.heartsSeen[c.id] ?? 0
          const isSpouse = companion.spouseIds.includes(c.id)
          const isSworn = companion.swornIds.includes(c.id)
          const bonded = isSpouse || isSworn
          const cross = isCrossAlignment(isDemonic(player), c.align)
          const stage = companion.postStage[c.id] ?? 0
          const endings = Object.entries(companion.endings).filter(([k]) => k.startsWith(`${c.id}_`))
          const counts = interactOf(c.id)
          const female = c.gender === 'female'
          return (
            <div
              key={c.id}
              className={`panel-box p-4 ${isSpouse ? 'border-gold' : ''} ${lockedHidden ? 'opacity-60' : ''}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-display text-gold">
                    {lockedHidden ? '？？？' : c.name}
                    {isSpouse && <span className="text-xs ml-2 text-bamboo">道侣</span>}
                    {isSworn && <span className="text-xs ml-2 text-gold">结拜</span>}
                    {c.hidden && !lockedHidden && (
                      <span className="text-xs ml-2 text-gold">隐藏</span>
                    )}
                    {!lockedHidden && (
                      <span className="text-xs ml-2 text-text-dim">
                        {female ? '女' : '男'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {lockedHidden
                      ? c.unlockHint ?? '缘分未至'
                      : `${c.title} · ${c.align === 'demonic' ? '魔道' : c.align === 'neutral' ? '散修' : '正道'}`}
                  </div>
                  {!lockedHidden && (
                    <p className="text-xs text-text mt-2 leading-relaxed">{c.desc}</p>
                  )}
                  {!lockedHidden && (
                    <>
                      <div className="text-xs text-jade mt-2">
                        好感 {aff} / {c.marryAt}
                        {cross && <span className="text-vermilion ml-2">正魔殊途</span>}
                      </div>
                      <div className="h-1.5 bg-ink border border-border mt-1 max-w-[220px]">
                        <div
                          className="h-full bg-bamboo"
                          style={{ width: `${Math.min(100, (aff / c.marryAt) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-text-dim mt-1">
                        心事件 {seen}/{c.heartAt.length}
                        {c.postStory && c.postStory.length > 0 && (
                          <span className="ml-2">
                            结缘线 {Math.min(stage, c.postStory.length)}/{c.postStory.length}
                          </span>
                        )}
                        {endings.map(([k, v]) => (
                          <span
                            key={k}
                            className={`ml-2 ${v === 'he' ? 'text-bamboo' : 'text-vermilion'}`}
                          >
                            {storyEndingLabel(v)}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    className="pixel-btn text-xs"
                    disabled={dead || lockedHidden}
                    onClick={() => chatCompanion(c.id)}
                  >
                    闲谈（{counts.chat}/{CHAT_AFFINITY_DAILY_LIMIT}）
                  </button>
                  <button
                    className="pixel-btn text-xs"
                    disabled={dead || giftCandidates.length === 0 || lockedHidden}
                    onClick={() => {
                      const pick = giftCandidates[0]
                      if (pick) giftCompanion(c.id, pick[0])
                    }}
                  >
                    赠礼 {counts.gift}/{GIFT_DAILY_LIMIT}
                  </button>
                  {female && (
                    <button
                      className="pixel-btn text-xs"
                      disabled={
                        dead ||
                        aff < DUAL_CULTIVATE_AFFINITY_MIN ||
                        lockedHidden
                      }
                      onClick={() => dualCultivate(c.id)}
                    >
                      双修
                    </button>
                  )}
                  <button
                    className="pixel-btn primary text-xs"
                    disabled={dead || bonded || aff < c.marryAt || lockedHidden}
                    onClick={() => propose(c.id)}
                  >
                    {female ? `结缘（${MARRY_STONES_COST}灵石）` : `结拜（${SWORN_STONES_COST}灵石）`}
                  </button>
                </div>
              </div>
              {!lockedHidden && giftCandidates.length > 1 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {giftCandidates.slice(0, 6).map(([id, n]) => (
                    <button
                      key={id}
                      className="text-[10px] border border-border px-1.5 py-0.5 text-text-dim hover:text-gold hover:border-gold-dim"
                      disabled={dead}
                      onClick={() => giftCompanion(c.id, id)}
                    >
                      {ITEMS[id]?.name}×{n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
