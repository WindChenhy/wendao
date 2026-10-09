import { useEffect, useRef, useState } from 'react'

/** 数字滚动（≤300ms），无依赖 */
export function useCountUp(target: number, ms = 280): number {
  const [val, setVal] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - k, 3)
      const v = Math.round(start + (target - start) * eased)
      setVal(v)
      from.current = v
      if (k < 1) raf = requestAnimationFrame(tick)
      else {
        from.current = target
        setVal(target)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}
