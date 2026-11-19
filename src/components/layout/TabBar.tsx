export type TabId = 'island' | 'codex' | 'dorm'

interface TabBarProps {
  active: TabId
  onChange: (tab: TabId) => void
}

const BASE =
  'flex h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[11px] font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf'
const ACTIVE = 'bg-white/85 text-ink shadow-[0_6px_18px_-10px_rgba(21,52,60,0.5)]'
const IDLE = 'text-ink/45 hover:bg-white/35 hover:text-ink/70'

function IslandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7 13.5c1.3 1.1 2.8 1.7 5 1.7s3.7-.6 5-1.7" />
      <path d="M10.5 9.5h3" />
    </svg>
  )
}

function CodexIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M20 18.5H6.5A2.5 2.5 0 0 0 4 21" />
      <path d="M8.5 7.5h8" />
    </svg>
  )
}

function DormIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
      <path d="M10.5 19v-4.5h3V19" />
    </svg>
  )
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      aria-label="主导航"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-1.5 rounded-[24px] border border-white/60 bg-[#FFFCF3]/78 p-1.5 shadow-[0_20px_50px_-24px_rgba(16,49,59,0.65)] backdrop-blur-xl">
        <button
          type="button"
          aria-current={active === 'island' ? 'page' : undefined}
          onClick={() => onChange('island')}
          className={`${BASE} ${active === 'island' ? ACTIVE : IDLE}`}
        >
          <IslandIcon />
          <span>岛屿</span>
        </button>
        <button
          type="button"
          aria-current={active === 'codex' ? 'page' : undefined}
          onClick={() => onChange('codex')}
          className={`${BASE} ${active === 'codex' ? ACTIVE : IDLE}`}
        >
          <CodexIcon />
          <span>图鉴</span>
        </button>
        <button
          type="button"
          disabled
          title="宿舍岛将在 Phase 2 开放"
          className={`${BASE} cursor-not-allowed text-ink/25`}
        >
          <DormIcon />
          <span>宿舍岛</span>
        </button>
      </div>
    </nav>
  )
}
