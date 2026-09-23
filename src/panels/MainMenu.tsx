import { useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'
import type { SaveSlotMeta } from '../types'

export function MainMenu() {
  const startCreate = useGameStore((s) => s.startCreate)
  const loadFromSlot = useGameStore((s) => s.loadFromSlot)
  const deleteSlot = useGameStore((s) => s.deleteSlot)
  const slotMeta = useGameStore((s) => s.slotMeta)
  const importSave = useGameStore((s) => s.importSave)
  const importSaveToSlot = useGameStore((s) => s.importSaveToSlot)

  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => [1, 2, 3].map((i) => slotMeta(i)))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const emptySlot = slots.find((s) => s.empty)?.index ?? null

  const refresh = () => setSlots([1, 2, 3].map((i) => slotMeta(i)))

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-widest text-gold mb-2">问道</h1>
          <p className="text-text-dim text-sm">文字修仙养成 · 轻松田园本体</p>
          <p className="text-text-dim text-xs mt-1">v0.9 · 宗门风云 / 道侣长线 / 任务链</p>
        </div>

        <div className="panel-box p-4 mb-4">
          <button className="pixel-btn primary w-full py-3 text-base font-display" onClick={startCreate}>
            新的修行
          </button>
        </div>

        <div className="panel-box p-4 mb-4">
          <div className="text-gold text-sm mb-3 font-display">读取存档</div>
          <div className="space-y-2">
            {slots.map((s) => (
              <div
                key={s.index}
                className="flex items-center justify-between gap-2 border border-border px-3 py-2"
              >
                <div className="text-left min-w-0">
                  <div className="text-sm">
                    {s.empty ? (
                      <span className="text-text-dim">存档位 {s.index} · 空</span>
                    ) : (
                      <>
                        {s.name}
                        <span className="text-gold ml-2">{s.realmLabel}</span>
                        <span className="text-text-dim ml-2">第{s.year}年</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="pixel-btn text-xs"
                    disabled={s.empty}
                    onClick={() => loadFromSlot(s.index)}
                  >
                    进入
                  </button>
                  <button
                    className="pixel-btn danger text-xs"
                    disabled={s.empty}
                    onClick={() => {
                      if (confirm(`删除存档位 ${s.index}？`)) {
                        deleteSlot(s.index)
                        refresh()
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="pixel-btn mt-3 text-xs" onClick={refresh}>
            刷新列表
          </button>
        </div>

        <div className="panel-box p-4">
          <div className="text-gold text-sm mb-2 font-display">导入加密存档</div>
          <input
            ref={fileRef}
            type="file"
            accept=".wdsave,.tyx,.json,application/json,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file || busy) return
              setBusy(true)
              setMsg('')
              const reader = new FileReader()
              reader.onload = () => {
                const content = String(reader.result ?? '')
                // 优先写入空槽位（桃源乡模式），无空位则直接进入游戏
                if (emptySlot != null && importSaveToSlot(emptySlot, content)) {
                  setMsg(`已导入到存档位 ${emptySlot}。`)
                  refresh()
                } else if (importSave(content)) {
                  setMsg('已导入并进入游戏。')
                  refresh()
                } else {
                  setMsg('导入失败：文件已损坏或不是有效存档。')
                }
                setBusy(false)
              }
              reader.onerror = () => {
                setMsg('读取文件失败。')
                setBusy(false)
              }
              reader.readAsText(file)
              e.target.value = ''
            }}
          />
          <button
            className="pixel-btn text-xs"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? '导入中…' : '选择 .wdsave 文件导入'}
          </button>
          {msg && (
            <div className={`text-xs mt-2 ${msg.startsWith('导入失败') ? 'text-vermilion' : 'text-bamboo'}`}>
              {msg}
            </div>
          )}
          <p className="text-xs text-text-dim mt-2">
            有空槽位时自动写入该槽；否则直接读入当前进度。文件为 AES 密文，无需密码。
          </p>
        </div>
      </div>
    </div>
  )
}
