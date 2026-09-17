import { useGameStore } from '../stores/useGameStore'

export function EventModal() {
  const pendingEvent = useGameStore((s) => s.pendingEvent)
  const resolveEvent = useGameStore((s) => s.resolveEvent)
  if (!pendingEvent) return null
  const evt = pendingEvent.event

  const typeLabel: Record<string, string> = {
    secret_realm: '秘境',
    treasure: '法宝出世',
    boss: '大妖拦路',
    fortune: '机缘',
    misfortune: '凶险',
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="panel-box w-full max-w-md p-5 border-gold">
        <div className="text-[11px] text-gold mb-1 font-display tracking-widest">
          奇遇 · {typeLabel[evt.type] ?? '事件'}
        </div>
        <h3 className="font-display text-xl text-gold mb-2">{evt.title}</h3>
        <p className="text-sm text-text mb-4 leading-relaxed">{evt.text}</p>
        <div className="flex flex-wrap gap-2">
          {evt.actions.map((a) => (
            <button
              key={a.id}
              className={`pixel-btn ${a.id === 'ignore' || a.id === 'flee' ? '' : 'primary'}`}
              onClick={() => resolveEvent(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
