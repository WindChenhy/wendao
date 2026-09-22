import { useState } from 'react'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORY_LABELS,
  describeReward,
  type AchievementCategory,
} from '../data/achievements'
import {
  CODEX_MILESTONES,
  CODEX_PAGE_IDS,
  CODEX_PAGE_META,
  codexEntries,
  codexRewardKey,
  collectionProgress,
  describeCodexReward,
  type CodexPageId,
} from '../data/codex'
import { useGameStore } from '../stores/useGameStore'

const ACHIEVE_CATS: AchievementCategory[] = [
  'milestone',
  'collect',
  'challenge',
  'story',
  'cycle',
]

export function CodexSection() {
  const [page, setPage] = useState<CodexPageId>('realm')
  const collection = useGameStore((s) => s.meta.collection)
  const claimed = useGameStore((s) => s.meta.codexRewardClaimed)
  const entries = codexEntries(page)
  const unlockedSet = new Set(collection[page] ?? [])
  const { unlocked, total, percent } = collectionProgress(page, collection)
  const meta = CODEX_PAGE_META[page]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {CODEX_PAGE_IDS.map((id) => {
          const p = collectionProgress(id, collection)
          return (
            <button
              key={id}
              className={`pixel-btn text-xs ${page === id ? 'primary' : ''}`}
              onClick={() => setPage(id)}
            >
              {CODEX_PAGE_META[id].name} {p.unlocked}/{p.total}
            </button>
          )
        })}
      </div>

      <div className="panel-box p-3">
        <div className="flex justify-between items-baseline gap-2 mb-1">
          <div className="font-display text-gold text-sm">{meta.name}图鉴</div>
          <div className="text-xs text-text-dim">
            {unlocked}/{total} · {percent}%
          </div>
        </div>
        <p className="text-xs text-text-dim mb-2">{meta.desc}</p>
        <div className="h-2 border border-border mb-3">
          <div className="h-full bg-gold/60" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {CODEX_MILESTONES.map((pct) => {
            const key = codexRewardKey(page, pct)
            const got = claimed.includes(key)
            const hit = percent >= pct
            return (
              <span
                key={pct}
                className={`text-[11px] border px-2 py-0.5 ${
                  got
                    ? 'border-jade text-jade'
                    : hit
                      ? 'border-gold text-gold'
                      : 'border-border text-text-dim'
                }`}
                title={describeCodexReward(meta.rewards[pct] ?? {})}
              >
                {pct}% · {got ? '已领' : hit ? '可结算' : describeCodexReward(meta.rewards[pct] ?? {})}
              </span>
            )
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {entries.map((e) => {
            const on = unlockedSet.has(e.id)
            return (
              <div
                key={e.id}
                className={`border px-3 py-2 ${on ? 'border-gold/60' : 'border-border opacity-45'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={on ? 'text-text' : 'text-text-dim'}>
                    {on ? e.name : '？？？'}
                  </span>
                  {e.meta && <span className="text-[11px] text-text-dim shrink-0">{e.meta}</span>}
                </div>
                <div className="text-xs text-text-dim mt-1 leading-snug">
                  {on ? e.desc : '尚未解锁'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function AchievementSection() {
  const [cat, setCat] = useState<AchievementCategory | 'all'>('all')
  const unlocked = useGameStore((s) => s.meta.achievements)
  const unlockedSet = new Set(unlocked)
  const list = ACHIEVEMENTS.filter((a) => cat === 'all' || a.category === cat)
  const doneCount = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        <button
          className={`pixel-btn text-xs ${cat === 'all' ? 'primary' : ''}`}
          onClick={() => setCat('all')}
        >
          全部 {doneCount}/{ACHIEVEMENTS.length}
        </button>
        {ACHIEVE_CATS.map((c) => (
          <button
            key={c}
            className={`pixel-btn text-xs ${cat === c ? 'primary' : ''}`}
            onClick={() => setCat(c)}
          >
            {ACHIEVEMENT_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="panel-box p-3 space-y-2">
        {list.map((a) => {
          const on = unlockedSet.has(a.id)
          return (
            <div
              key={a.id}
              className={`border px-3 py-2 ${on ? 'border-jade/70' : 'border-border'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={on ? 'text-jade font-display text-sm' : 'text-text text-sm'}>
                  {on && <span className="mr-1">✓</span>}
                  {a.name}
                </span>
                <span className="text-[11px] text-text-dim shrink-0">
                  {ACHIEVEMENT_CATEGORY_LABELS[a.category]}
                </span>
              </div>
              <div className="text-xs text-text-dim mt-1">{a.desc}</div>
              <div className={`text-xs mt-1 ${on ? 'text-gold' : 'text-text-dim'}`}>
                {describeReward(a.reward)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
