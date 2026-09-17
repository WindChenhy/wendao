import { useState } from 'react'
import { useGameStore } from '../stores/useGameStore'
import type { SaveSlotMeta } from '../types'

export function MainMenu() {
  const startCreate = useGameStore((s) => s.startCreate)
  const loadFromSlot = useGameStore((s) => s.loadFromSlot)
  const deleteSlot = useGameStore((s) => s.deleteSlot)
  const slotMeta = useGameStore((s) => s.slotMeta)
  const importSave = useGameStore((s) => s.importSave)

  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => [1, 2, 3].map((i) => slotMeta(i)))
  const [msg, setMsg] = useState('')

  const refresh = () => setSlots([1, 2, 3].map((i) => slotMeta(i)))

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-widest text-gold mb-2">问道</h1>
          <p className="text-text-dim text-sm">文字修仙养成 · 轻松田园本体</p>
          <p className="text-text-dim text-xs mt-1">v0.1 · 宗门 / 秘境 / 道侣 / 七职业</p>
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
          <div className="text-gold text-sm mb-2 font-display">导入存档 JSON</div>
          <textarea
            id="import-box"
            className="w-full h-20 bg-ink border border-border text-xs p-2 text-text"
            placeholder="粘贴导出的存档 JSON…"
          />
          {msg && <div className="text-xs text-vermilion mt-1">{msg}</div>}
          <button
            className="pixel-btn mt-2 text-xs"
            onClick={() => {
              const el = document.getElementById('import-box') as HTMLTextAreaElement
              const ok = importSave(el.value)
              setMsg(ok ? '' : '导入失败：格式无效')
            }}
          >
            导入
          </button>
        </div>

        <p className="text-center text-xs text-text-dim mt-6 leading-relaxed">
          参考桃源乡式面板养成 · 本作为原创修仙题材原型
          <br />
          存档保存在浏览器 localStorage
        </p>
      </div>
    </div>
  )
}
