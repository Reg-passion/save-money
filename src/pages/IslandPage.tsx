import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import AddBill from '../components/AddBill'
import DailyReport from '../components/DailyReport'
import Egg from '../components/Egg'
import Island, { IslandScene } from '../components/Island'
import IslandTopBar from '../components/IslandTopBar'
import MonsterAnimation from '../components/MonsterAnimation'
import QuickAdd from '../components/QuickAdd'
import SavingsCore from '../components/SavingsCore'
import TowerGame from '../components/TowerGame'
import WeeklyReport from '../components/WeeklyReport'
import WishPool from '../components/WishPool'
import { CATEGORIES } from '../data/categories'
import { SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import {
  DAILY_SUMMON_LIMIT,
  countSummonsForDate,
  getSpiritCollectionSummary,
  type SpiritCollectionSummary,
} from '../lib/summon'
import {
  DEFAULT_BUDGETS,
  dailyScore,
  toDateKey,
  weekDates,
} from '../lib/budget'
import { recordExpense, type ExpenseOutcome } from '../lib/expense'
import {
  combineSpentCents,
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
  isNewSpirit: boolean
}

type SceneState = 'loading' | 'ready' | 'failed'

function scrollToId(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  if (target instanceof HTMLDetailsElement) target.open = true
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

function billMeta(bill: Bill): string {
  const spirit = bill.summonedSpiritId ? SPIRIT_BY_ID[bill.summonedSpiritId] : null
  if (spirit) return `召唤 ${spirit.name}`
  if (bill.summonOutcome === 'energy') return '岛屿能量 +1'
  if (bill.source === 'wish') return '许愿确认'
  if (bill.source === 'import') return '历史导入'
  return '日常记账'
}

export default function IslandPage() {
  const [settings, setSettings] = useState<IslandSettings>(() => loadSettings())
  const [bills, setBills] = useState<Bill[]>(() => loadBills())
  const [wishes, setWishes] = useState<WishRecord[]>(() => loadWishes())
  const [collection, setCollection] = useState<SpiritCollectionSummary>(() =>
    getSpiritCollectionSummary(),
  )
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dayNight, setDayNight] = useState(() => getAutoDayNight())
  const [soundOn, setSoundOn] = useState(true)
  const [coinSignal, setCoinSignal] = useState(0)
  const [sceneState, setSceneState] = useState<SceneState>('loading')

  const summary = summarizeMonth(bills, settings)
  const weather = getWeather(summary.hp)
  const progress = getSavingsProgress(summary, settings)
  const fallback = sceneState === 'failed'

  const [now] = useState(() => new Date())
  const todayKey = toDateKey(now)
  const weekKeys = new Set(weekDates(now))
  const todayBills = bills.filter((bill) => toDateKey(bill.time) === todayKey)
  const weekBills = bills.filter((bill) => weekKeys.has(toDateKey(bill.time)))
  const todaySpentCents = combineSpentCents(todayBills)
  const weekSpentCents = combineSpentCents(weekBills)
  const todayScore = dailyScore(todaySpentCents, DEFAULT_BUDGETS.daily)
  const summonedToday = countSummonsForDate(bills, todayKey)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

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

  function showBillOutcome(bill: Bill, hpBefore: number) {
    const nextBills = loadBills()
    setBills(nextBills)
    setCollection(getSpiritCollectionSummary())

    if (bill.summonOutcome === 'energy') {
      setEncounter(null)
      setNotice('今天的 5 只精灵已经召唤满，这一笔只增加岛屿能量。')
      return
    }

    const monster = SPIRIT_BY_ID[bill.summonedSpiritId ?? bill.monsterId]
    if (!monster) return
    setEncounter({
      monster,
      bill,
      hpBefore,
      hpAfter: summarizeMonth(nextBills, settings).hp,
      isNewSpirit: bill.spiritIsNew === true,
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
    showBillOutcome(outcome.bill, hpBefore)
    return outcome
  }

  function handleConfirmWish(wishId: string) {
    const hpBefore = summary.hp
    const { bill } = confirmWish(wishId)
    celebrateBill()
    setWishes(loadWishes())
    showBillOutcome(bill, hpBefore)
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
    <div className="flex flex-1 flex-col gap-3">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 pb-36 pt-3 sm:px-5">
        <IslandTopBar
          islandName={settings.islandName}
          weather={weather}
          dayNight={dayNight}
          soundOn={soundOn}
          onDayNightChange={setDayNight}
          onToggleSound={handleToggleSound}
          todaySpentCents={todaySpentCents}
          dailyBudgetCents={DEFAULT_BUDGETS.daily}
          weekSpentCents={weekSpentCents}
          weeklyBudgetCents={DEFAULT_BUDGETS.weekly}
          codexProgress={collection.progress}
          codexTotal={collection.total}
          summonedToday={summonedToday}
          summonLimit={DAILY_SUMMON_LIMIT}
        />

        {notice && (
          <p
            role="status"
            className="pointer-events-auto rounded-2xl border border-[#E4BE93] bg-[#FBF0E0]/92 px-4 py-2.5 text-[11px] leading-relaxed text-[#8A5A2B]"
          >
            {notice}
          </p>
        )}

        {fallback && (
          <p
            role="status"
            className="pointer-events-auto rounded-2xl border border-[#E4BE93] bg-[#FBF0E0]/92 px-4 py-2.5 text-[11px] leading-relaxed text-[#8A5A2B]"
          >
            3D 加载失败，已切换到 2D 岛屿，记账功能不受影响。
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.8fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3">
          <section className="relative h-[46svh] min-h-[340px] max-h-[560px] overflow-hidden rounded-[28px] border border-white/55 bg-[#EAF4DF] shadow-[0_26px_60px_-30px_rgba(20,55,64,0.55)]">
            {!fallback && (
              <Suspense fallback={null}>
                <SceneBoundary onError={() => setSceneState('failed')}>
                  <Island3D
                    panel
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
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: getSkyGradient(dayNight) }}
              >
                <IslandScene hp={summary.hp} weather={weather} />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#09232e]/24 via-transparent to-[#09232e]/38 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl border border-white/35 bg-[#FFFCF3]/72 px-3 py-2 backdrop-blur-md">
                  <p className="text-[9px] font-semibold tracking-[0.24em] text-ink/40">
                    HOME ISLAND
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold leading-tight text-ink">
                    {settings.islandName}
                  </h2>
                  <p className="mt-0.5 text-[10px] text-ink/55">
                    岛血 {summary.hp}/100 · {weather === 'repair' ? '修补模式' : '正在生长'}
                  </p>
                </div>
                <span className="rounded-full border border-white/40 bg-white/35 px-2.5 py-1 text-[9px] font-medium text-ink/60 backdrop-blur-md">
                  {fallback
                    ? '2D 岛屿模式'
                    : sceneState === 'ready'
                      ? '拖动旋转 · 滚轮缩放'
                      : '正在铺开小岛…'}
                </span>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="max-w-[15rem] rounded-2xl bg-white/28 px-3 py-1.5 text-[10px] leading-relaxed text-ink/60 backdrop-blur-md">
                  本月预算没花掉的部分会变成建筑；记账会召唤精灵，每天最多 5 只。
                </p>
                <nav
                  aria-label="岛屿快捷操作"
                  className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/55 bg-[#FFFCF3]/78 p-1 shadow-[0_16px_35px_-18px_rgba(20,55,64,0.55)] backdrop-blur-xl"
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
            </div>
          </section>

          <section
            id="bills-list"
            className="glass-panel pointer-events-auto scroll-mt-24 p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold tracking-[0.28em] text-ink/30">
                  LEDGER
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-ink">近 30 天账单</h2>
              </div>
              <span className="rounded-full bg-white/55 px-2.5 py-1 text-[10px] text-ink/50">
                {bills.length} 笔
              </span>
            </div>
            {bills.length === 0 ? (
              <p className="mt-2 rounded-2xl border border-dashed border-white/70 bg-white/35 px-4 py-6 text-center text-xs text-ink/45">
                还没有账单，记下今天的第一笔。
              </p>
            ) : (
              <ul className="mt-2 max-h-[430px] divide-y divide-ink/5 overflow-y-auto overscroll-contain rounded-2xl border border-white/60 bg-white/45">
                {bills.map((bill) => (
                  <li key={bill.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/65 text-xs font-semibold text-ink/55">
                      {(CATEGORY_NAMES.get(bill.category) ?? '账').slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {CATEGORY_NAMES.get(bill.category) ?? '杂项'}
                        {bill.note ? ` · ${bill.note}` : ''}
                      </p>
                      <p className="text-[10px] text-ink/40">
                        {formatBillTime(bill.time)} · {billMeta(bill)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-ink">
                        -{formatCents(bill.amountCents)} 元
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <SavingsCore
              todaySpentCents={todaySpentCents}
              dailyBudgetCents={DEFAULT_BUDGETS.daily}
              weekSpentCents={weekSpentCents}
              weeklyBudgetCents={DEFAULT_BUDGETS.weekly}
              todayScore={todayScore}
              todayBillCount={todayBills.length}
              codexProgress={collection.progress}
              codexTotal={collection.total}
              summonedToday={summonedToday}
              summonLimit={DAILY_SUMMON_LIMIT}
            />

            <div id="add-bill" className="pointer-events-auto scroll-mt-24">
              <AddBill onAdd={handleAdd} />
            </div>

            <div className="flex flex-col gap-3">
            <div className="pointer-events-auto">
              <WishPool wishes={wishes} onConfirm={handleConfirmWish} onCancel={handleCancelWish} />
            </div>

            <div className="pointer-events-auto">
              <Egg />
            </div>

            <div className="pointer-events-auto">
              <TowerGame />
            </div>

            <div className="pointer-events-auto">
              <Island
                settings={settings}
                summary={summary}
                weather={weather}
                onSaveSettings={handleSaveSettings}
              />
            </div>
          </div>
        </div>

        <section
          id="reports"
          aria-label="日报与周报"
          className="pointer-events-auto grid scroll-mt-24 gap-3 lg:grid-cols-2 lg:items-start"
        >
          <DailyReport />
          <WeeklyReport />
        </section>
      </div>
      </div>

      <QuickAdd />

      {encounter && (
        <MonsterAnimation
          key={encounter.bill.id}
          monster={encounter.monster}
          bill={encounter.bill}
          hpBefore={encounter.hpBefore}
          hpAfter={encounter.hpAfter}
          isNewSpirit={encounter.isNewSpirit}
          onDone={() => setEncounter(null)}
        />
      )}
    </div>
  )
}