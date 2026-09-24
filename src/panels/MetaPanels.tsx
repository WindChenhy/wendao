import { useState } from 'react'
import { BUILTIN_DLC } from '../dlc/builtin'
import { loadEnabledDlc, saveEnabledDlc } from '../dlc/types'
import { describeExportError, downloadTextFile } from '../game/saveCrypto'
import { buildSaveFileName, describeSaveTimeline } from '../game/reincarnate'
import { useGameStore } from '../stores/useGameStore'
import { AchievementSection, CodexSection } from './CodexPanels'

type SettingsTab = 'general' | 'codex' | 'achievement'

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>('general')
  const achievements = useGameStore((s) => s.meta.achievements)
  const collection = useGameStore((s) => s.meta.collection)
  const codexTotal = Object.values(collection).reduce((n, list) => n + list.length, 0)

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div className="flex flex-wrap gap-2">
        <button
          className={`pixel-btn text-xs ${tab === 'general' ? 'primary' : ''}`}
          onClick={() => setTab('general')}
        >
          设置
        </button>
        <button
          className={`pixel-btn text-xs ${tab === 'codex' ? 'primary' : ''}`}
          onClick={() => setTab('codex')}
        >
          图鉴（{codexTotal} 条）
        </button>
        <button
          className={`pixel-btn text-xs ${tab === 'achievement' ? 'primary' : ''}`}
          onClick={() => setTab('achievement')}
        >
          成就（{achievements.length}）
        </button>
      </div>
      {tab === 'general' && <GeneralSettings />}
      {tab === 'codex' && <CodexSection />}
      {tab === 'achievement' && <AchievementSection />}
    </div>
  )
}

function GeneralSettings() {
  const saveToSlot = useGameStore((s) => s.saveToSlot)
  const loadFromSlot = useGameStore((s) => s.loadFromSlot)
  const exportSaveEncrypted = useGameStore((s) => s.exportSaveEncrypted)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const player = useGameStore((s) => s.player)
  const time = useGameStore((s) => s.time)
  const legacy = useGameStore((s) => s.legacy)
  const skipExploreCombat = useGameStore((s) => s.skipExploreCombat)
  const setSkipExploreCombat = useGameStore((s) => s.setSkipExploreCombat)
  const [enabled, setEnabled] = useState<string[]>(() => loadEnabledDlc())
  const [exportMsg, setExportMsg] = useState('')

  const toggleDlc = (id: string) => {
    const next = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id]
    setEnabled(next)
    saveEnabledDlc(next)
  }

  const buildFileName = () => {
    if (!player) return 'wendao-save.wdsave'
    return buildSaveFileName({
      name: player.name,
      year: time.year,
      month: time.month,
      day: time.day,
      reincarnations: legacy.reincarnations,
    })
  }

  const timelineNote = player
    ? describeSaveTimeline({
        reincarnations: legacy.reincarnations,
        year: time.year,
        age: player.age,
        totalYears: legacy.totalYears ?? 0,
        lastLifeEndYear: legacy.lastLifeEndYear ?? 0,
      })
    : ''

  const handleExportFile = () => {
    if (!player) return
    try {
      const cipher = exportSaveEncrypted()
      const fname = buildFileName()
      downloadTextFile(fname, cipher)
      setExportMsg(
        `已下载「${fname}」。\n${timelineNote}\n说明：文件名中的年号为「本世」年号；转生后从第 1 年重新起算，不会沿用上一世年号。转生次数见文件名中的「转生N次」。`,
      )
    } catch (e) {
      setExportMsg(describeExportError(e))
    }
  }

  return (
    <>
      <div className="panel-box p-4">
        <div className="font-display text-gold mb-3">战斗</div>
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1"
            checked={skipExploreCombat}
            onChange={(e) => setSkipExploreCombat(e.target.checked)}
          />
          <span>
            历练 / 秘境跳过战斗
            <span className="block text-xs text-text-dim mt-1">
              开启后：历练「踏入山野」、秘境「迎战本层」均直接自动结算，不进入战斗面板；战报仍可在对应页面查看。
              宗门大比、奇遇等仍进入战斗面板。
            </span>
          </span>
        </label>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-3">转生与年纪</div>
        <div className="text-xs text-text-dim space-y-1 leading-relaxed">
          <div>
            当前：
            <span className="text-gold">
              {legacy.reincarnations > 0
                ? `第 ${legacy.reincarnations} 次转生后 · 本世第${time.year}年`
                : `尚未转生 · 第${time.year}年`}
            </span>
            {player && <span className="ml-2">寿龄 {player.age}</span>}
          </div>
          <div>年号规则：转生后本世年号从第 1 年重新起算，不沿用上一世。</div>
          <div>
            累计：历代寿龄约{' '}
            <span className="text-text">{(legacy.totalYears ?? 0) + (player?.age ?? 0)}</span>
            {legacy.lastLifeEndYear > 0 && (
              <span className="ml-2">上一世结束于第{legacy.lastLifeEndYear}年</span>
            )}
          </div>
          <div>导出存档文件名会标注「转生N次」与「本世第X年」，便于区分周目。</div>
          {timelineNote && <div className="text-bamboo">{timelineNote}</div>}
        </div>
      </div>

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
        <div className="mt-4">
          <button className="pixel-btn text-xs" disabled={!player} onClick={handleExportFile}>
            导出存档
          </button>
        </div>
        {player && (
          <p className="text-xs text-text-dim mt-2">
            导出文件名预览：
            <span className="text-bamboo">{buildFileName()}</span>
          </p>
        )}
        {exportMsg && (
          <p className="text-xs text-bamboo mt-2 whitespace-pre-line leading-relaxed">{exportMsg}</p>
        )}
        <p className="text-xs text-text-dim mt-2">
          CryptoJS AES + 应用固定密钥。本地槽位与导出文件均为密文。图鉴/成就/道痕/转生次数随存档保存。
        </p>
        {legacy.daoMarks > 0 && (
          <p className="text-xs text-text-dim mt-3">
            道痕 {legacy.daoMarks} · 转生 {legacy.reincarnations} 次（跨周目继承；图鉴与成就同样保留）
          </p>
        )}
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">DLC 内容包</div>
        <p className="text-xs text-text-dim mb-3">
          内容包仅合并数据与规则补丁，不执行任意脚本。启用后立即生效于修炼、突破与事件池。
        </p>
        <div className="space-y-2">
          {BUILTIN_DLC.map((pack) => {
            const on = enabled.includes(pack.manifest.id)
            return (
              <div key={pack.manifest.id} className="border border-border px-3 py-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-sm">
                      {pack.manifest.name}
                      <span className="text-xs text-text-dim ml-2">v{pack.manifest.version}</span>
                    </div>
                    <div className="text-xs text-text-dim mt-1">{pack.manifest.desc}</div>
                    <ul className="text-xs text-text-dim mt-1 list-disc pl-4">
                      {pack.manifest.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className={`pixel-btn text-xs shrink-0 ${on ? 'primary' : ''}`}
                    onClick={() => toggleDlc(pack.manifest.id)}
                  >
                    {on ? '已启用' : '启用'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel-box p-4">
        <div className="font-display text-gold mb-2">其他</div>
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
          《问道》v1.1 · React + TypeScript + Zustand + Tailwind
          <br />
          战斗职业 · 离线修炼 · 图鉴成就 · 炼器词条 · 跳过战斗 · DLC · 加密存档
        </p>
      </div>
    </>
  )
}
