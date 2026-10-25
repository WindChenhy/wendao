import { beforeAll, describe, expect, it, vi } from 'vitest'

// 必须在 import store 之前桩掉 localStorage：store 模块加载时会读取游戏设置
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
})

type StoreModule = typeof import('./useGameStore')

let useGameStore: StoreModule['useGameStore']

beforeAll(async () => {
  useGameStore = (await import('./useGameStore')).useGameStore
})

/** 造一个满足条件的新角色 */
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

/** 清掉可能阻塞后续打坐的弹层（奇遇/道侣剧情） */
function clearBlocking() {
  useGameStore.setState({ pendingEvent: null, pendingStory: null })
}

describe('日课：按现实日刷新（打坐跨游戏日不清进度）', () => {
  it('打坐推进游戏日，但日课进度保留，3 次打坐可完成「打坐修炼 3 次」', () => {
    newCharacter()
    useGameStore.getState().ensureDaily()
    // 固定当日修行日课只含 meditate，便于精确断言
    useGameStore.setState((s) => ({
      daily: { ...s.daily!, tasks: [{ id: 'meditate', progress: 0, claimed: false }] },
    }))

    for (let i = 1; i <= 3; i++) {
      clearBlocking()
      useGameStore.getState().meditate()
      const d = useGameStore.getState().daily!
      const med = d.tasks.find((t) => t.id === 'meditate')
      expect(med?.progress, `第 ${i} 次打坐后进度应为 ${i}`).toBe(i)
    }

    // 打坐确实推进了游戏日（时间在走），日课却未被重掷
    const d = useGameStore.getState().daily!
    expect(d.tasks).toHaveLength(1)
    expect(d.tasks[0].progress).toBe(3)
  })

  it('历练（同样跨游戏日）也不清空其他日课进度', () => {
    newCharacter()
    useGameStore.getState().ensureDaily()
    useGameStore.setState((s) => ({
      daily: {
        ...s.daily!,
        tasks: [
          { id: 'meditate', progress: 2, claimed: false },
          { id: 'explore', progress: 0, claimed: false },
        ],
      },
    }))
    clearBlocking()
    useGameStore.getState().meditate()
    const d = useGameStore.getState().daily!
    expect(d.tasks.find((t) => t.id === 'meditate')?.progress).toBe(3)
    expect(d.tasks.find((t) => t.id === 'explore')?.progress).toBe(0)
    expect(d.tasks).toHaveLength(2)
  })
})

describe('日课：跨现实日刷新时保留功行', () => {
  it('重掷任务与进度，但已累计的日课功行不清零', () => {
    newCharacter()
    useGameStore.getState().ensureDaily()
    useGameStore.setState((s) => ({
      daily: {
        ...s.daily!,
        dayKey: '2000-01-01',
        points: 3,
        tasks: [{ id: 'meditate', progress: 3, claimed: true }],
      },
    }))

    useGameStore.getState().ensureDaily()
    const d = useGameStore.getState().daily!
    expect(d.dayKey).not.toBe('2000-01-01')
    expect(d.points).toBe(3)
    expect(d.tasks).toHaveLength(3)
    expect(d.tasks.every((t) => t.progress === 0 && !t.claimed)).toBe(true)
  })
})
