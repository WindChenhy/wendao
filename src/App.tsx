import { useGameStore } from './stores/useGameStore'
import { CreateCharacter } from './panels/CreateCharacter'
import { GameLayout } from './panels/GameLayout'
import { MainMenu } from './panels/MainMenu'

export default function App() {
  const phase = useGameStore((s) => s.phase)

  return (
    <div className="h-full min-h-svh bg-ink text-text">
      {phase === 'menu' && <MainMenu />}
      {phase === 'create' && <CreateCharacter />}
      {phase === 'play' && <GameLayout />}
    </div>
  )
}
