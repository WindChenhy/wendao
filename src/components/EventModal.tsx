import { useGameStore } from '../stores/useGameStore'
import type { WorldEventAction } from '../data/events'
import { ITEMS } from '../data/items'

const TYPE_LABEL: Record<string, string> = {
  secret_realm: '秘境',
  treasure: '法宝出世',
  boss: '大妖拦路',
  fortune: '机缘',
  misfortune: '凶险',
  sect: '宗门风云',
  faction: '正魔争锋',
  companion: '红尘缘法',
  omen: '天象',
}

function costLabel(a: WorldEventAction): string {
  const c = a.cost
  if (!c) return ''
  const parts: string[] = []
  if (c.stones) parts.push(`灵石 ${c.stones}`)
  if (c.contribution) parts.push(`贡献 ${c.contribution}`)
  if (c.items) {
    for (const [id, n] of Object.entries(c.items)) {
      parts.push(`${ITEMS[id]?.name ?? id} ×${n}`)
    }
  }
  return parts.length ? `（${parts.join('，')}）` : ''
}

export function EventModal() {
  const pendingEvent = useGameStore((s) => s.pendingEvent)
  const resolveEvent = useGameStore((s) => s.resolveEvent)
  const stones = useGameStore((s) => s.stones)
  const contribution = useGameStore((s) => s.sect.contribution)
  const inventory = useGameStore((s) => s.inventory)
  if (!pendingEvent) return null
  const evt = pendingEvent.event

  const canPay = (a: WorldEventAction) => {
    const c = a.cost
    if (!c) return true
    if (c.stones && stones < c.stones) return false
    if (c.contribution && contribution < c.contribution) return false
    if (c.items) {
      for (const [id, n] of Object.entries(c.items)) {
        if ((inventory[id] ?? 0) < n) return false
      }
    }
    return true
  }

  const primary = (a: WorldEventAction) =>
    a.id !== 'ignore' && a.id !== 'flee' && a.id !== 'decline' && a.id !== 'wait'

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="panel-box w-full max-w-md p-5 border-gold">
        <div className="text-[11px] text-gold mb-1 font-display tracking-widest">
          奇遇 · {TYPE_LABEL[evt.type] ?? '事件'}
          {evt.pack && evt.pack !== 'core' && (
            <span className="ml-2 text-text-dim">{evt.pack === 'sect_storm' ? '宗门风云' : evt.pack === 'faction_war' ? '正魔争锋' : evt.pack === 'omen' ? '天象' : ''}</span>
          )}
        </div>
        <h3 className="font-display text-xl text-gold mb-2">{evt.title}</h3>
        <p className="text-sm text-text mb-4 leading-relaxed">{evt.text}</p>
        <div className="flex flex-wrap gap-2">
          {evt.actions.map((a) => (
            <button
              key={a.id}
              className={`pixel-btn text-xs ${primary(a) ? 'primary' : ''}`}
              disabled={!canPay(a)}
              title={canPay(a) ? undefined : '代价不足'}
              onClick={() => resolveEvent(a.id)}
            >
              {a.label}
              {costLabel(a)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StoryModal() {
  const pendingStory = useGameStore((s) => s.pendingStory)
  const resolveStory = useGameStore((s) => s.resolveStory)
  const daoMarks = useGameStore((s) => s.legacy.daoMarks)
  if (!pendingStory) return null
  const { beat } = pendingStory

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="panel-box w-full max-w-md p-5 border-gold">
        <div className="text-[11px] text-gold mb-1 font-display tracking-widest">
          红尘缘法 · 结缘后
        </div>
        <h3 className="font-display text-xl text-gold mb-2">{beat.title}</h3>
        <p className="text-sm text-text mb-4 leading-relaxed">{beat.text}</p>
        {beat.choices && beat.choices.length > 0 ? (
          <div className="flex flex-col gap-2">
            {beat.choices.map((c) => {
              const needDao = c.daoMarksCost ?? 0
              const can = daoMarks >= needDao
              return (
                <button
                  key={c.id}
                  className="pixel-btn text-left text-xs leading-relaxed"
                  disabled={!can}
                  title={can ? undefined : '道痕不足'}
                  onClick={() => resolveStory(c.id)}
                >
                  {c.label}
                  {c.ending === 'he' && <span className="ml-2 text-bamboo">【良缘】</span>}
                  {c.ending === 'be' && <span className="ml-2 text-vermilion">【遗恨】</span>}
                  {needDao ? <span className="ml-2 text-gold">（道痕 -{needDao}）</span> : null}
                </button>
              )
            })}
          </div>
        ) : (
          <button className="pixel-btn primary" onClick={() => resolveStory(null)}>
            继续
          </button>
        )}
        <div className="text-[11px] text-text-dim mt-3">红尘一诺 · 抉择将进入图鉴结局</div>
      </div>
    </div>
  )
}
