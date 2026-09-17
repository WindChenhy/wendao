import { useState } from 'react'
import { BUILTIN_DLC } from '../dlc/builtin'
import { loadEnabledDlc, saveEnabledDlc } from '../dlc/types'
import { describeExportError, downloadTextFile } from '../game/saveCrypto'
import { useGameStore } from '../stores/useGameStore'

export function SettingsPanel() {
  const saveToSlot = useGameStore((s) => s.saveToSlot)
  const loadFromSlot = useGameStore((s) => s.loadFromSlot)
  const exportSaveEncrypted = useGameStore((s) => s.exportSaveEncrypted)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const player = useGameStore((s) => s.player)
  const time = useGameStore((s) => s.time)
  const legacy = useGameStore((s) => s.legacy)
  const [enabled, setEnabled] = useState<string[]>(() => loadEnabledDlc())
  const [exportMsg, setExportMsg] = useState('')

  const toggleDlc = (id: string) => {
    const next = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id]
    setEnabled(next)
    saveEnabledDlc(next)
  }

  const buildFileName = () => {
    if (!player) return 'wendao-save.wdsave'
    // 参照桃源乡命名：角色_年月日
    return `存档_${player.name}_第${time.year}年${time.month}月${time.day}日.wdsave`
  }

  const handleExportFile = () => {
    if (!player) return
    try {
      const cipher = exportSaveEncrypted()
      downloadTextFile(buildFileName(), cipher)
      setExportMsg('已下载加密存档文件（.wdsave）。')
    } catch (e) {
      setExportMsg(describeExportError(e))
    }
  }

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
        <div className="mt-4">
          <button className="pixel-btn text-xs" disabled={!player} onClick={handleExportFile}>
            导出存档
          </button>
        </div>
        {exportMsg && <p className="text-xs text-bamboo mt-2">{exportMsg}</p>}
        <p className="text-xs text-text-dim mt-2">
          与桃源乡同构：CryptoJS AES + 应用固定密钥。本地槽位与导出文件均为密文，导入时自动解密。
        </p>
        {legacy.daoMarks > 0 && (
          <p className="text-xs text-text-dim mt-3">
            道痕 {legacy.daoMarks} · 转生 {legacy.reincarnations} 次（跨周目继承）
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
          《问道》v0.4 · React + TypeScript + Zustand + Tailwind
          <br />
          灵植炼丹 · 转生道痕 · DLC 内容包 · 加密存档
        </p>
      </div>
    </div>
  )
}
