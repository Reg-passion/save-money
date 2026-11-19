import { useState } from 'react'
import StorageNotice from './components/layout/StorageNotice'
import TabBar, { type TabId } from './components/layout/TabBar'
import CodexPage from './pages/CodexPage'
import DormPage from './pages/DormPage'
import IslandPage from './pages/IslandPage'

export default function App() {
  const [tab, setTab] = useState<TabId>('island')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <StorageNotice />
      <main className="flex flex-1 flex-col px-5 pb-32 pt-8">
        {tab === 'island' && <IslandPage />}
        {tab === 'codex' && <CodexPage />}
        {tab === 'dorm' && <DormPage />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
