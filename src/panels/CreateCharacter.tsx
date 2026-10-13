import { useState } from 'react'
import { APTITUDES } from '../data/aptitudes'
import { ORIGINS } from '../data/origins'
import { ROLL_CONFIG } from '../data/characterRoll'
import { displayItemName } from '../data/items'
import {
  affinityMul,
  aptitudeRollPresencePct,
  rollTalentOptions,
  talentKey,
  type TalentOption,
} from '../game/characterRoll'
import { useGameStore } from '../stores/useGameStore'
import type { Gender } from '../types'

function kitText(items: Record<string, number>): string {
  const parts = Object.entries(items).map(([id, n]) => `${displayItemName(id)}×${n}`)
  return parts.length > 0 ? parts.join('、') : '别无长物'
}

export function CreateCharacter() {
  const createCharacter = useGameStore((s) => s.createCharacter)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  // 首次进入即随机第一卷（计入 maxRolls 限额）
  const [options, setOptions] = useState<TalentOption[]>(() => rollTalentOptions())
  const [rollsUsed, setRollsUsed] = useState(1)
  const [picked, setPicked] = useState<number | null>(null)

  const exhausted = rollsUsed >= ROLL_CONFIG.maxRolls
  const rollsLeft = ROLL_CONFIG.maxRolls - rollsUsed

  const reroll = () => {
    if (exhausted) return
    // 跨卷多样性：排除上一卷出现过的组合（池子不足时算法自动忽略）
    const exclude = new Set(options.map(talentKey))
    setOptions(rollTalentOptions(ROLL_CONFIG, Math.random, exclude))
    setPicked(null)
    setRollsUsed((n) => n + 1)
  }

  const chosen = picked !== null ? options[picked] : null

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-3xl panel-box p-6">
        <h2 className="font-display text-2xl text-gold mb-1 text-center">踏入仙途</h2>
        <p className="text-text-dim text-xs text-center mb-6">
          灵根天定，出身各别。天道掷卷：每卷 {ROLL_CONFIG.optionCount} 种天命任选其一，共{' '}
          {ROLL_CONFIG.maxRolls} 卷，
          {exhausted ? '天命已定。' : `还可重掷 ${rollsLeft} 次。`}此处不定职业——道途在你修行途中自然显形。
        </p>

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

        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-text-dim">
            灵根与出身（天道随机，每卷 {ROLL_CONFIG.optionCount} 选 1，共 {ROLL_CONFIG.maxRolls} 卷）
          </label>
          <button
            className={`pixel-btn text-xs ${exhausted ? '' : 'primary'}`}
            disabled={exhausted}
            onClick={reroll}
          >
            {exhausted ? '天命已定' : `重掷天命（余 ${rollsLeft} 次）`}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {options.map((opt, i) => {
            const a = APTITUDES[opt.aptitude]
            const o = ORIGINS[opt.origin]
            const selected = picked === i
            const pact = affinityMul(ROLL_CONFIG, opt.aptitude, opt.origin) > 1
            const chance = Math.round(aptitudeRollPresencePct(ROLL_CONFIG, opt.aptitude))
            return (
              <button
                key={talentKey(opt)}
                onClick={() => setPicked(i)}
                className={`text-left border px-3 py-2 rounded-sm transition-colors ${
                  selected
                    ? 'border-gold bg-[#2a2618] text-gold'
                    : 'border-border bg-ink-2 text-text hover:border-gold-dim'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display">
                    {a.name} · {o.name}
                  </span>
                  <span className="text-[10px] text-text-dim">
                    {a.rarity} · 每卷出现率约{chance}%
                  </span>
                </div>
                <div className="text-xs text-text-dim mt-1 leading-snug">{a.desc}</div>
                <div className="text-[11px] mt-1 text-gold-dim">{a.detail}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {pact && (
                    <span className="text-[10px] border border-gold-dim px-1 text-gold-dim">
                      机缘相契
                    </span>
                  )}
                  {a.tags.map((t) => (
                    <span key={t} className="text-[10px] border border-border px-1 text-text-dim">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-text-dim mt-2 pt-1 border-t border-border/60 leading-snug">
                  <span className="text-text">{o.name}</span>：{o.desc}
                </div>
                <div className="text-[11px] mt-1 text-gold-dim">
                  灵石 {o.startStones} · {kitText(o.startItems)}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-text-dim leading-relaxed mb-4 border border-border/60 px-3 py-2">
          道途不在此处定下。先以吐纳立身：历练搏杀可悟剑道/体道，久炼丹火可成丹道，
          亲手炼器可入器道，观符破阵可学符道/阵道，驯兽、炼傀、施针、抚琴亦各成一途；魂道与魔道则需禁忌机缘与代价。
          待条件具足，到「人物」页「问道」即可立道——首立者为主修，其后为兼修。
        </p>

        <div className="flex gap-2">
          <button className="pixel-btn" onClick={backToMenu}>
            返回
          </button>
          <button
            className="pixel-btn primary flex-1"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              createCharacter({ name, gender, aptitude: chosen.aptitude, origin: chosen.origin })
            }}
          >
            {chosen ? '开始修行' : '请先选定一卷天命'}
          </button>
        </div>
      </div>
    </div>
  )
}
