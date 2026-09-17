import { create } from 'zustand'
import type { LogEntry, LogLevel } from '../types'

let seq = 1

interface LogState {
  entries: LogEntry[]
  push: (text: string, level?: LogLevel) => void
  clear: () => void
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  push: (text, level = 'info') =>
    set((s) => ({
      entries: [
        ...s.entries.slice(-199),
        { id: seq++, day: '', text, level },
      ],
    })),
  clear: () => set({ entries: [] }),
}))
