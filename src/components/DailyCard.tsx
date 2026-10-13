import { useEffect } from 'react'
import { DAILY_TASK_MAP, WEEK_GIFT } from '../data/daily'
import { useGameStore } from '../stores/useGameStore'

/** v1.4 修炼页顶部：修行日课（按现实日刷新，与焚香记日一致）+ 现实日「焚香记日」 */
export function DailyCard() {
  const player = useGameStore((s) => s.player)
  const daily = useGameStore((s) => s.daily)
  const checkin = useGameStore((s) => s.checkin)
  const ensureDaily = useGameStore((s) => s.ensureDaily)
  const claimDailyTask = useGameStore((s) => s.claimDailyTask)
  const claimDailyWeekGift = useGameStore((s) => s.claimDailyWeekGift)
  const claimCheckin = useGameStore((s) => s.claimCheckin)

  useEffect(() => {
    ensureDaily()
  }, [ensureDaily])

  if (!player) return null
  const dead = !player.alive
  const checkedToday = checkin.lastDate === todayKey()
  const weekReady = daily.points >= WEEK_GIFT.points

  return (
    <div className="panel-box p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="font-display text-gold">修行日课</div>
        <button
          className={`pixel-btn text-xs ${checkedToday ? '' : 'primary'}`}
          disabled={dead || checkedToday}
          onClick={claimCheckin}
        >
          {checkedToday ? `今日已焚香 · 连记 ${checkin.streak} 日` : '焚香记日'}
        </button>
      </div>
      <div className="space-y-1.5">
        {daily.tasks.map((t) => {
          const def = DAILY_TASK_MAP[t.id]
          if (!def) return null
          const done = t.progress >= def.target
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <span className={t.claimed ? 'text-text-dim line-through' : ''}>
                {def.desc}
                <span className={`ml-2 ${done ? 'text-jade' : 'text-text-dim'}`}>
                  {Math.min(t.progress, def.target)}/{def.target}
                </span>
              </span>
              <button
                className={`pixel-btn text-[10px] shrink-0 ${done && !t.claimed ? 'primary' : ''}`}
                disabled={dead || !done || t.claimed}
                onClick={() => claimDailyTask(t.id)}
              >
                {t.claimed ? '已领' : done ? '领取' : '未完成'}
              </button>
            </div>
          )
        })}
        {daily.tasks.length === 0 && (
          <p className="text-xs text-text-dim">修行日课生成中……（进行任意操作后刷新）</p>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-xs">
        <span className="text-text-dim">
          日课功行 <span className="text-gold">{daily.points}</span>/{WEEK_GIFT.points}（全清 +1）
        </span>
        <button
          className={`pixel-btn text-[10px] ${weekReady ? 'primary' : ''}`}
          disabled={dead || !weekReady}
          onClick={claimDailyWeekGift}
        >
          领七日之赐
        </button>
      </div>
    </div>
  )
}

function todayKey(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}
