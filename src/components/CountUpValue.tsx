import { useCountUp } from './useCountUp'

/**
 * 数字滚动展示组件。
 * 动画期间每帧都会 setState，若由宿主面板直接用 hook，则整块面板（如 700 行的 SectPanel）
 * 每帧全量重渲染 —— 故把动画状态下沉到该叶子组件（P2-7）。
 */
export function CountUpValue({ value, ms }: { value: number; ms?: number }) {
  return <>{useCountUp(value, ms)}</>
}
