import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// 必须在 import store 之前桩掉 localStorage：store 模块加载时会读取游戏设置
const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
})

type StoreModule = typeof import('./useGameStore')

let useGameStore: StoreModule['useGameStore']

beforeAll(async () => {
  useGameStore = (await import('./useGameStore')).useGameStore
})

beforeEach(() => {
  memory.clear()
})

function newCharacter() {
  useGameStore.getState().backToMenu()
  useGameStore.getState().startCreate()
  useGameStore.getState().createCharacter({
    name: '无涯',
    gender: 'male',
    aptitude: 'heaven',
    origin: 'fallen',
  })
}

describe('存档快照字段完整性', () => {
  it('存读档后灵兽捕捉软保底计数 petCaptureFails 保留（曾漏存导致读档清零）', () => {
    newCharacter()
    useGameStore.setState({ petCaptureFails: 2 })
    expect(useGameStore.getState().saveToSlot(1)).toBe(true)

    // 清空计数后读档，应恢复存档中的值而非 0
    useGameStore.setState({ petCaptureFails: 0 })
    expect(useGameStore.getState().loadFromSlot(1)).toBe(true)
    expect(useGameStore.getState().petCaptureFails).toBe(2)
  })
})
