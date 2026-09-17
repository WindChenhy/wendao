import { useState } from 'react'
import { CLASS_LIST } from '../data/classes'
import { useGameStore } from '../stores/useGameStore'
import type { ClassId, Gender } from '../types'

export function CreateCharacter() {
  const createCharacter = useGameStore((s) => s.createCharacter)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [classId, setClassId] = useState<ClassId>('sword')

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-2xl panel-box p-6">
        <h2 className="font-display text-2xl text-gold mb-1 text-center">踏入仙途</h2>
        <p className="text-text-dim text-xs text-center mb-6">选择出身与道路。魔修将站在正道对立面。</p>

        <label className="block text-sm mb-1 text-text-dim">道号</label>
        <input
          className="w-full bg-ink border border-border px-3 py-2 mb-4 text-text"
          value={name}
          maxLength={12}
          placeholder="输入你的名号"
          onChange={(e) => setName(e.target.value)}
        />

        <label className="block text-sm mb-1 text-text-dim">性别</label>
        <div className="flex gap-2 mb-4">
          {(
            [
              ['male', '男'],
              ['female', '女'],
            ] as const
          ).map(([g, label]) => (
            <button
              key={g}
              className={`pixel-btn ${gender === g ? 'primary' : ''}`}
              onClick={() => setGender(g)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block text-sm mb-2 text-text-dim">主职业（7 选 1）</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {CLASS_LIST.map((c) => (
            <button
              key={c.id}
              onClick={() => setClassId(c.id)}
              className={`text-left border px-3 py-2 rounded-sm transition-colors ${
                classId === c.id
                  ? 'border-gold bg-[#2a2618] text-gold'
                  : 'border-border bg-ink-2 text-text hover:border-gold-dim'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display">{c.name}</span>
                <span className="text-[10px] text-text-dim">
                  {c.faction === 'demonic' ? '魔道' : c.faction === 'neutral' ? '中立' : '正道'}
                </span>
              </div>
              <div className="text-xs text-text-dim mt-1 leading-snug">{c.desc}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {c.tags.map((t) => (
                  <span key={t} className="text-[10px] border border-border px-1 text-text-dim">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="pixel-btn" onClick={backToMenu}>
            返回
          </button>
          <button
            className="pixel-btn primary flex-1"
            onClick={() => createCharacter({ name, gender, classId })}
          >
            开始修行
          </button>
        </div>
      </div>
    </div>
  )
}
