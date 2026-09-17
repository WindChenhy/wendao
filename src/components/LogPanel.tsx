import { useEffect, useRef } from 'react'
import { useLogStore } from '../stores/useLogStore'

export function LogPanel() {
  const entries = useLogStore((s) => s.entries)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [entries])

  return (
    <div className="border-t border-border bg-ink-2 h-36 md:h-40 flex flex-col">
      <div className="px-3 py-1 text-[11px] text-text-dim border-b border-border/50 font-display">
        修行手记
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto scroll-thin px-3 py-2 text-xs space-y-0.5">
        {entries.length === 0 && <div className="text-text-dim">尚无记录。</div>}
        {entries.map((e) => (
          <div key={e.id} className={`log-line t-${e.level === 'info' ? 'dim' : e.level}`}>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  )
}
