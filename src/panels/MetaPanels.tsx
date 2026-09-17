import { useGameStore } from '../stores/useGameStore'

export function SettingsPanel() {
  const saveToSlot = useGameStore((s) => s.saveToSlot)
  const loadFromSlot = useGameStore((s) => s.loadFromSlot)
  const exportSave = useGameStore((s) => s.exportSave)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const player = useGameStore((s) => s.player)

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="panel-box p-4">
        <div className="font-display text-gold mb-3">存档</div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-1">
              <button className="pixel-btn text-xs" onClick={() => saveToSlot(i)}>
                存入 {i}
              </button>
              <button className="pixel-btn text-xs" onClick={() => loadFromSlot(i)}>
                读取 {i}
              </button>
            </div>
          ))}
        </div>
        <button
          className="pixel-btn mt-4 text-xs"
          onClick={() => {
            const json = exportSave()
            if (!json) return
            navigator.clipboard?.writeText(json).then(
              () => alert('存档 JSON 已复制到剪贴板'),
              () => {
                const w = window.open('', '_blank')
                w?.document.write(`<pre>${json}</pre>`)
              },
            )
          }}
        >
          导出存档（复制 JSON）
        </button>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-3">其他</div>
        <button className="pixel-btn" onClick={backToMenu}>
          回到主菜单
        </button>
        {player && (
          <p className="text-xs text-text-dim mt-3">
            当前角色：{player.name} · 未存档的进度在刷新后会丢失。
          </p>
        )}
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">关于</div>
        <p className="text-xs text-text-dim leading-relaxed">
          《问道》v0.3 · React + TypeScript + Zustand + Tailwind
          <br />
          设计文档见 <code className="text-gold">docs/修仙养成游戏方案.md</code>
        </p>
      </div>
    </div>
  )
}
