import { useLogStore } from '../useLogStore'

export function log(text: string, level: 'info' | 'good' | 'bad' | 'gold' | 'dim' = 'info') {
  useLogStore.getState().push(text, level)
}
