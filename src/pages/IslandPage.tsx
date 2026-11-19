import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import AddBill from '../components/AddBill'
import Island, { IslandScene } from '../components/Island'
import IslandTopBar from '../components/IslandTopBar'
import MonsterAnimation from '../components/MonsterAnimation'
import Settlement from '../components/Settlement'
import WishPool from '../components/WishPool'
import { CATEGORIES } from '../data/categories'
import { SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import { recordExpense, type ExpenseOutcome } from '../lib/expense'
import {
  formatBillTime,
  getWeather,
  loadBills,
  loadSettings,
  saveSettings,
  summarizeMonth,
  type Bill,
  type IslandSettings,
  type NewBillInput,
} from '../lib/island'
import {
  getAutoDayNight,
  getSavingsProgress,
  getSkyGradient,
} from '../lib/island3d'
import { formatCents } from '../lib/money'
import { cancelWish, confirmWish, loadWishes, type WishRecord } from '../lib/wish'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))
const Island3D = lazy(() => import('../components/Island3D'))

interface SceneBoundaryProps {
  onError: () => void
  children: ReactNode
}

class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

interface Encounter {
  monster: Spirit
  bill: Bill
  hpBefore: number
  hpAfter: number
}

type SceneState = 'loading' | 'ready' | 'failed'

function scrollToId(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  if (target instanceof HTMLDetailsElement) target.open = true
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export default function IslandPage() {
  const [settings, setSettings] = useState<IslandSettings>(() => loadSettings())
  const [bills, setBills] = useState<Bill[]>(() => loadBills())
  const [wishes, setWishes] = useState<WishRecord[]>(() => loadWishes())
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [dayNight, setDayNight] = useState(() => getAutoDayNight())
  const [soundOn, setSoundOn] = useState(true)
  const [coinSignal, setCoinSignal] = useState(0)
  const [sceneState, setSceneState] = useState<SceneState>('loading')

  const summary = summarizeMonth(bills, settings)
  const weather = getWeather(summary.hp)
  const progress = getSavingsProgress(summary, settings)
  const fallback = sceneState === 'failed'

  function celebrateBill() {
    setCoinSignal((value) => value + 1)
    if (soundOn) {
      void import('../lib/coinEffect')
        .then(({ playCoinSound }) => playCoinSound())
        .catch(() => {
          // 音效文件加载失败时静默降级。
        })
    }
  }

  function showMonster(bill: Bill, hpBefore: number) {
    const nextBills = loadBills()
    setBills(nextBills)
    const monster = SPIRIT_BY_ID[bill.monsterId]
    if (!monster) return
    setEncounter({
      monster,
      bill,
      hpBefore,
      hpAfter: summarizeMonth(nextBills, settings).hp,
    })
  }

  function handleAdd(input: NewBillInput, planned: boolean): ExpenseOutcome {
    const hpBefore = summary.hp
    const outcome = recordExpense(input, { planned })
    if (outcome.kind === 'wish') {
      setWishes(loadWishes())
      return outcome
    }
    celebrateBill()
    showMonster(outcome.bill, hpBefore)
    return outcome
  }

  function handleConfirmWish(wishId: string) {
    const hpBefore = summary.hp
    const { bill } = confirmWish(wishId)
    celebrateBill()
    setWishes(loadWishes())
    showMonster(bill, hpBefore)
  }

  function handleCancelWish(wishId: string) {
    cancelWish(wishId)
    setWishes(loadWishes())
  }

  function handleSaveSettings(next: IslandSettings) {
    setSettings(saveSettings(next))
  }

  function handleToggleSound() {
    if (!soundOn) {
      void import('../lib/coinEffect')
        .then(({ playCoinSound }) => playCoinSound())
        .catch(() => {
          // 音效文件加载失败时静默降级。
        })
    }
    setSoundOn((value) => !value)
  }

  return (
    <div className="pointer-events-none flex flex-1 flex-col gap-3">
      {!fallback && (
        <Suspense fallback={null}>
          <SceneBoundary onError={() => setSceneState('failed')}>
            <Island3D
              progress={progress}
              dayNight={dayNight}
              hp={summary.hp}
              coinSignal={coinSignal}
              onReady={() => setSceneState('ready')}
              onUnavailable={() => setSceneState('failed')}
            />
          </SceneBoundary>
        </Suspense>
      )}

      {fallback && (
        <div
          className="fixed inset-0 z-0"
          style={{ background: getSkyGradient(dayNight) }}
          aria-hidden="true"
        >
          <div className="flex h-full items-center justify-center pb-24">
            <div className="w-[min(80vw,360px)] opacity-95">
              <IslandScene hp={summary.hp} weather={weather} />
            </div>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,transparent_35%,rgba(9,35,46,0.12)_100%)]" />
        </div>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 pb-40 pt-3 sm:px-5">
        <IslandTopBar
          settings={settings}
          summary={summary}
          weather={weather}
          progress={progress}
          dayNight={dayNight}
          soundOn={soundOn}
          onDayNightChange={setDayNight}
          onToggleSound={handleToggleSound}
        />

        {fallback && (
          <p
            role="status"
            className="pointer-events-auto rounded-2xl border border-[#E4BE93] bg-[#FBF0E0]/92 px-4 py-2.5 text-[11px] leading-relaxed text-[#8A5A2B]"
          >
            3D 加载失败，已切换到 2D 岛屿，记账功能不受影响。
          </p>
        )}

        <div className="pointer-events-none flex h-[34svh] min-h-[240px] max-h-[380px] flex-col items-center justify-end gap-2 pb-1 lg:h-[44svh]">
          <span className="rounded-full border border-white/45 bg-white/30 px-3 py-1 text-[10px] font-medium text-ink/50 backdrop-blur-md">
            {fallback
              ? '2D 岛屿模式'
              : sceneState === 'ready'
                ? '拖动旋转 · 滚轮 / 双指缩放'
                : '正在铺开小岛…'}
          </span>
          <nav
            aria-label="岛屿快捷操作"
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/60 bg-[#FFFCF3]/72 p-1 shadow-[0_16px_35px_-18px_rgba(20,55,64,0.55)] backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => scrollToId('add-bill')}
              className="min-h-9 rounded-full bg-leaf px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#549A5F]"
            >
              ＋ 记一笔
            </button>
            <button
              type="button"
              onClick={() => scrollToId('island-settings')}
              className="min-h-9 rounded-full px-2.5 text-[11px] font-medium text-ink/55 transition-colors hover:bg-white/60 hover:text-ink"
            >
              目标
            </button>
            <button
              type="button"
              onClick={() => scrollToId('bills-list')}
              className="min-h-9 rounded-full px-2.5 text-[11px] font-medium text-ink/55 transition-colors hover:bg-white/60 hover:text-ink"
            >
              账单
            </button>
          </nav>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="flex flex-col gap-3">
            <Island
              settings={settings}
              summary={summary}
              weather={weather}
              onSaveSettings={handleSaveSettings}
            />

            <div id="add-bill" className="pointer-events-auto scroll-mt-44">
              <AddBill onAdd={handleAdd} />
            </div>

            <div className="pointer-events-auto">
              <WishPool wishes={wishes} onConfirm={handleConfirmWish} onCancel={handleCancelWish} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="pointer-events-auto">
              <Settlement summary={summary} settings={settings} />
            </div>

            <section
              id="bills-list"
              className="glass-panel pointer-events-auto scroll-mt-44 p-4"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-ink">本月账单</h2>
                <span className="text-xs text-ink/40">{summary.bills.length} 笔</span>
              </div>
              {summary.bills.length === 0 ? (
                <p className="mt-2 rounded-2xl border border-dashed border-white/70 bg-white/35 px-4 py-6 text-center text-xs text-ink/45">
                  还没有账单，记下今天的第一笔。
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-2xl border border-white/60 bg-white/45">
                  {summary.bills.map((bill) => (
                    <li key={bill.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/65 text-xs font-semibold text-ink/55">
                        {(CATEGORY_NAMES.get(bill.category) ?? '账').slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {CATEGORY_NAMES.get(bill.category) ?? '杂项'}
                          {bill.note ? ` · ${bill.note}` : ''}
                        </p>
                        <p className="text-[11px] text-ink/40">
                          {formatBillTime(bill.time)}
                          {bill.source === 'wish' && ' · 许愿确认'}
                          {bill.source === 'import' && ' · 历史导入'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-ink">
                          -{formatCents(bill.amountCents)} 元
                        </p>
                        <p className="text-[11px] text-ink/40">
                          -{summary.billDamages[bill.id] ?? 0} 点血
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {encounter && (
        <MonsterAnimation
          key={encounter.bill.id}
          monster={encounter.monster}
          bill={encounter.bill}
          hpBefore={encounter.hpBefore}
          hpAfter={encounter.hpAfter}
          onDone={() => setEncounter(null)}
        />
      )}
    </div>
  )
}
