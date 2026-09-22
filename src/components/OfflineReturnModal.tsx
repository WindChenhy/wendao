import { formatOfflineDuration } from '../game/offline'
import { formatNum } from '../game/format'
import { useGameStore, type OfflinePending } from '../stores/useGameStore'

export function OfflineReturnModal() {
  const pending = useGameStore((s) => s.offlinePending)
  const resolveOffline = useGameStore((s) => s.resolveOffline)
  if (!pending) return null
  return <OfflineInner pending={pending} resolve={resolveOffline} />
}

function OfflineInner({
  pending,
  resolve,
}: {
  pending: OfflinePending
  resolve: (mode: 'accept' | 'stone' | 'pill') => void
}) {
  const canStone = pending.stones >= pending.deepenStoneCost && pending.deepenStoneExp > 0
  const canPill = pending.pillId && pending.deepenPillExp > 0

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="panel-box w-full max-w-md p-5 border-gold">
        <div className="text-[11px] text-gold mb-1 font-display tracking-widest">闭关归来</div>
        <h3 className="font-display text-xl text-gold mb-2">山中无甲子</h3>
        <p className="text-sm text-text mb-3 leading-relaxed">
          你静坐调息，灵气缓缓入体。离线约 {formatOfflineDuration(pending.elapsedMs)}
          {pending.hoursCounted < pending.hoursRaw && (
            <span className="text-text-dim">
              （境界所限，仅计 {pending.hoursCounted.toFixed(1)} / 上限 {pending.capHours} 小时）
            </span>
          )}
          。
        </p>
        <div className="border border-border px-3 py-2 mb-4 text-sm space-y-1">
          <div>
            修为入账 <span className="text-jade">+{formatNum(pending.expGain)}</span>
            <span className="text-xs text-text-dim ml-2">
              约 {pending.expPerHour}/小时 · 不自动突破
            </span>
          </div>
          <div className="text-xs text-text-dim">
            可选加深闭关，换取额外修为；灵石/丹药只影响本次收益。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="pixel-btn primary" onClick={() => resolve('accept')}>
            直接出关
          </button>
          <button
            className="pixel-btn"
            disabled={!canStone}
            title={canStone ? `花费灵石 ${pending.deepenStoneCost}` : '灵石不足或无额外收益'}
            onClick={() => resolve('stone')}
          >
            灵石加深 +{formatNum(pending.deepenStoneExp)}
            <span className="text-xs text-text-dim ml-1">（{pending.deepenStoneCost} 灵石）</span>
          </button>
          <button
            className="pixel-btn"
            disabled={!canPill}
            title={canPill ? `消耗 ${pending.pillName}` : '无可用丹药'}
            onClick={() => resolve('pill')}
          >
            丹药加深 +{formatNum(pending.deepenPillExp)}
            <span className="text-xs text-text-dim ml-1">（{pending.pillName}）</span>
          </button>
        </div>
      </div>
    </div>
  )
}
