/** 轻体验：钟磬短音 + 数字滚动（无外部素材） */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    return ctx
  } catch {
    return null
  }
}

/** 建筑升级 / 重要入账：钟磬一记（双泛音，约 0.4s） */
export function playBell(): void {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime
  const master = ac.createGain()
  master.gain.value = 0.12
  master.connect(ac.destination)
  for (const [freq, dur] of [
    [528, 0.45],
    [792, 0.35],
    [1056, 0.22],
  ] as const) {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.8, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }
}

/** 贡献池小额入账：更短的磬点 */
export function playChime(): void {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 880
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
  osc.connect(g)
  g.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + 0.2)
}
