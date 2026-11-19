import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CATEGORIES } from '../data/categories'
import { WISH_THRESHOLD_CENTS } from '../data/constants'
import type { CategoryId, IslandState, Transaction } from '../types'
import {
  applyDailyBudget,
  applyWeeklyBudget,
  sumByCategory,
  sumTransactions,
} from '../lib/budget'
import { formatBillTime, toDateTimeLocalValue } from '../lib/island'
import {
  QUICK_TEMPLATES,
  addTransaction,
  cancelWishRecord,
  confirmWishRecord,
  createWishRecord,
  deleteTransaction,
  filterTransactions,
  isWishReady,
  loadWishRecords,
  saveWishRecords,
  updateTransaction,
  wishRemainingMs,
  type AmountFilter,
  type TimeFilter,
  type TransactionFilters,
  type WishRecordV2,
} from '../lib/ledger'
import { centsToInputValue, formatCents, parseYuanToCents } from '../lib/money'
import { loadState, saveState } from '../lib/storage'

const CATEGORY_NAME = new Map(CATEGORIES.map((category) => [category.id, category.name]))

const AMOUNT_FILTERS: { value: AmountFilter; label: string }[] = [
  { value: 'all', label: '全部金额' },
  { value: 'under20', label: '20 元以下' },
  { value: '20to50', label: '20–50 元' },
  { value: '50to100', label: '50–100 元' },
  { value: 'over100', label: '100 元及以上' },
]

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'last7', label: '近 7 天' },
  { value: 'last30', label: '近 30 天' },
]

const FIELD_CLASS =
  'mt-1 min-h-11 w-full rounded-xl border border-ink/10 bg-white/75 px-3 text-sm text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/25'
const LABEL_CLASS = 'block text-[11px] font-semibold text-ink/55'
const SMALL_ACTION_CLASS =
  'min-h-11 rounded-xl px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf'

function categoryName(category: CategoryId): string {
  return CATEGORY_NAME.get(category) ?? '其他'
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export default function QuickAdd() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<IslandState>(() => loadState())
  const [wishes, setWishes] = useState<WishRecordV2[]>(() => loadWishRecords())
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [customCategory, setCustomCategory] = useState<CategoryId>('milk-tea')
  const [dailyInput, setDailyInput] = useState(() =>
    centsToInputValue(loadState().budgets.daily),
  )
  const [weeklyInput, setWeeklyInput] = useState(() =>
    centsToInputValue(loadState().budgets.weekly),
  )
  const [filters, setFilters] = useState<TransactionFilters>({
    category: 'all',
    amount: 'all',
    time: 'all',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState<CategoryId>('milk-tea')
  const [editNote, setEditNote] = useState('')
  const [editTime, setEditTime] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const fabRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const pendingWishes = wishes.filter((wish) => wish.status === 'pending')
  const filteredTransactions = useMemo(
    () => filterTransactions(state.transactions, filters, now),
    [state.transactions, filters, now],
  )
  const filteredTotalCents = useMemo(
    () => sumTransactions(filteredTransactions),
    [filteredTransactions],
  )
  const categoryTotals = useMemo(
    () => sumByCategory(filteredTransactions),
    [filteredTransactions],
  )
  const customCents = parseYuanToCents(customAmount)
  const customGoesToWish =
    customCents !== null &&
    state.settings.wishPoolEnabled &&
    customCents >= WISH_THRESHOLD_CENTS

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[data-quick-template]')
        ?.focus({ preventScroll: true })
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        fabRef.current?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || fabRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || pendingWishes.length === 0) return
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [open, pendingWishes.length])

  function notify(kind: 'ok' | 'error', text: string) {
    setFeedback({ kind, text })
  }

  function closePanel() {
    setOpen(false)
    requestAnimationFrame(() => fabRef.current?.focus())
  }

  function togglePanel() {
    if (open) {
      closePanel()
      return
    }
    const next = loadState()
    setState(next)
    setWishes(loadWishRecords())
    setDailyInput(centsToInputValue(next.budgets.daily))
    setWeeklyInput(centsToInputValue(next.budgets.weekly))
    setNow(new Date())
    setFeedback(null)
    setCustomOpen(false)
    setEditingId(null)
    setPendingDeleteId(null)
    setOpen(true)
  }

  function persistState(next: IslandState): boolean {
    try {
      saveState(next)
      setState(next)
      return true
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '保存失败，请稍后重试')
      return false
    }
  }

  function addQuickExpense(amountCents: number, category: CategoryId, note: string) {
    const current = loadState()
    if (current.settings.wishPoolEnabled && amountCents >= WISH_THRESHOLD_CENTS) {
      try {
        const wish = createWishRecord({ amountCents, category, note })
        const nextWishes = [wish, ...loadWishRecords()]
        saveWishRecords(nextWishes)
        setWishes(nextWishes)
        notify('ok', `已放进许愿池，冷静 24 小时后确认才记账。`)
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '没能放进许愿池')
      }
      return
    }

    try {
      const result = addTransaction(current, { amountCents, category, note })
      saveState(result.state)
      setState(result.state)
      const spiritText = result.transaction.spiritId ? '，图鉴 +1' : ''
      notify(
        'ok',
        `已记 ${formatCents(amountCents)} 元 · 怪物血量 ${result.transaction.monsterHp}${spiritText}`,
      )
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '记账失败，请稍后重试')
    }
  }

  function handleCustomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (customCents === null) {
      notify('error', '请输入大于 0 的金额，最多两位小数')
      return
    }
    addQuickExpense(customCents, customCategory, '')
    setCustomAmount('')
    setCustomOpen(false)
  }

  function handleDailyBudget(value: string) {
    setDailyInput(value)
    const cents = parseYuanToCents(value)
    if (cents === null) return
    const budgets = applyDailyBudget(state.budgets, cents)
    if (persistState({ ...state, budgets })) {
      setWeeklyInput(centsToInputValue(budgets.weekly))
      notify('ok', `日预算改为 ${formatCents(budgets.daily)} 元，周预算同步为 ${formatCents(budgets.weekly)} 元`)
    }
  }

  function handleWeeklyBudget(value: string) {
    setWeeklyInput(value)
    const cents = parseYuanToCents(value)
    if (cents === null) return
    const budgets = applyWeeklyBudget(state.budgets, cents)
    if (persistState({ ...state, budgets })) {
      notify('ok', `周预算改为 ${formatCents(budgets.weekly)} 元`)
    }
  }

  function restoreBudgetInputIfNeeded() {
    if (parseYuanToCents(dailyInput) === null) {
      setDailyInput(centsToInputValue(state.budgets.daily))
      notify('error', '日预算没保存，请输入大于 0 的金额')
    }
    if (parseYuanToCents(weeklyInput) === null) {
      setWeeklyInput(centsToInputValue(state.budgets.weekly))
      notify('error', '周预算没保存，请输入大于 0 的金额')
    }
  }

  function handleWishToggle(enabled: boolean) {
    const next = { ...state, settings: { ...state.settings, wishPoolEnabled: enabled } }
    if (persistState(next)) {
      notify('ok', enabled ? '大额许愿池已开启' : '大额许愿池已关闭，现在会直接记账')
    }
  }

  function handleConfirmWish(wishId: string) {
    try {
      const result = confirmWishRecord(state, wishes, wishId, new Date())
      saveState(result.state)
      saveWishRecords(result.wishes)
      setState(result.state)
      setWishes(result.wishes)
      notify(
        'ok',
        `已确认记账 ${formatCents(result.transaction.amountCents)} 元 · 怪物血量 ${result.transaction.monsterHp}`,
      )
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '确认失败')
    }
  }

  function handleCancelWish(wishId: string) {
    try {
      const nextWishes = cancelWishRecord(wishes, wishId, new Date())
      saveWishRecords(nextWishes)
      setWishes(nextWishes)
      notify('ok', '这笔许愿已取消，没有记账')
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '取消失败')
    }
  }

  function beginEdit(transaction: Transaction) {
    setEditingId(transaction.id)
    setEditAmount(centsToInputValue(transaction.amountCents))
    setEditCategory(transaction.category)
    setEditNote(transaction.note)
    setEditTime(toDateTimeLocalValue(new Date(transaction.time)))
    setPendingDeleteId(null)
  }

  function handleSaveEdit(event: FormEvent<HTMLFormElement>, transactionId: string) {
    event.preventDefault()
    const cents = parseYuanToCents(editAmount)
    if (cents === null) {
      notify('error', '金额需要大于 0，最多两位小数')
      return
    }
    try {
      const next = updateTransaction(state, transactionId, {
        amountCents: cents,
        category: editCategory,
        note: editNote,
        time: editTime,
      })
      if (persistState(next)) {
        setEditingId(null)
        notify('ok', '账单已更新，统计已同步')
      }
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '修改失败')
    }
  }

  function handleDelete(transactionId: string) {
    try {
      const next = deleteTransaction(state, transactionId)
      if (persistState(next)) {
        setPendingDeleteId(null)
        if (editingId === transactionId) setEditingId(null)
        notify('ok', '已删除这笔账单，统计已同步')
      }
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '删除失败')
    }
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        aria-label={open ? '收起轻记账' : '打开轻记账'}
        aria-expanded={open}
        aria-controls="quick-add-panel"
        onClick={togglePanel}
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-leaf text-white shadow-[0_18px_36px_-14px_rgba(38,91,54,0.78)] transition hover:scale-105 hover:bg-[#529961] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf"
      >
        <PlusIcon
          className={`h-8 w-8 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
        />
      </button>

      {open && (
        <div
          id="quick-add-panel"
          ref={panelRef}
          role="dialog"
          aria-labelledby="quick-add-title"
          tabIndex={-1}
          className="fixed inset-x-3 bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-h-[min(72dvh,44rem)] w-auto max-w-[26rem] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[#FFFCF3]/96 shadow-[0_30px_80px_-28px_rgba(16,49,59,0.72)] backdrop-blur-2xl focus:outline-none sm:inset-x-auto sm:right-5 sm:mx-0 sm:w-[26rem]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-ink/8 px-4 pb-3 pt-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.22em] text-leaf/80">
                QUICK LEDGER
              </p>
              <h2 id="quick-add-title" className="mt-0.5 text-lg font-semibold text-ink">
                轻记账
              </h2>
              <p className="mt-0.5 text-[11px] text-ink/60">点一下模板就记完，想改再改。</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="收起轻记账"
              className="glass-icon-button"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-3">
            <div role="status" aria-live="polite">
              {feedback && (
                <p
                  className={`mb-3 rounded-xl px-3 py-2 text-[11px] font-medium ${
                    feedback.kind === 'error'
                      ? 'bg-[#FBEAE3] text-[#9B4A35]'
                      : 'bg-[#E8F3E4] text-[#3E7350]'
                  }`}
                >
                  {feedback.text}
                </p>
              )}
            </div>

            <section aria-label="快速记账">
              <button
                type="button"
                aria-expanded={customOpen}
                aria-controls="quick-custom-form"
                onClick={() => setCustomOpen((value) => !value)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/55 p-2.5 text-left transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-leaf text-white shadow-[0_8px_18px_-8px_rgba(38,91,54,0.75)]">
                  <PlusIcon
                    className={`h-6 w-6 transition-transform duration-200 ${
                      customOpen ? 'rotate-45' : ''
                    }`}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">自定义一笔</span>
                  <span className="mt-0.5 block text-[11px] text-ink/50">
                    填个金额就行，分类可改
                  </span>
                </span>
                <span aria-hidden="true" className="ml-auto pr-1 text-lg text-ink/30">
                  ›
                </span>
              </button>

              {customOpen && (
                <form
                  id="quick-custom-form"
                  onSubmit={handleCustomSubmit}
                  className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-2xl border border-white/70 bg-white/55 p-2.5"
                >
                  <label htmlFor="quick-custom-amount" className={LABEL_CLASS}>
                    金额（元）
                    <input
                      id="quick-custom-amount"
                      name="amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(event) => setCustomAmount(event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label htmlFor="quick-custom-category" className={LABEL_CLASS}>
                    分类
                    <select
                      id="quick-custom-category"
                      name="category"
                      value={customCategory}
                      onChange={(event) =>
                        setCustomCategory(event.target.value as CategoryId)
                      }
                      className={FIELD_CLASS}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={customCents === null}
                    className="min-h-11 rounded-xl bg-ink px-3 text-xs font-semibold text-cream transition hover:bg-[#25363c] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {customGoesToWish ? '许愿' : '记下'}
                  </button>
                </form>
              )}

              <div className="mt-2 grid grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    data-quick-template
                    onClick={() =>
                      addQuickExpense(template.amountCents, template.category, template.note)
                    }
                    className="min-h-[4.5rem] rounded-2xl border border-white/70 bg-white/60 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_20px_-16px_rgba(16,49,59,0.6)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{template.label}</span>
                      <span className="text-base font-semibold tabular-nums text-[#3F7D4C]">
                        ¥{formatCents(template.amountCents)}
                      </span>
                    </span>
                    <span className="mt-1 block text-[10px] text-ink/55">
                      {categoryName(template.category)} · 点一下就记
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="budget-heading"
              className="mt-3 rounded-2xl border border-white/70 bg-white/45 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 id="budget-heading" className="text-sm font-semibold text-ink">
                  预算
                </h3>
                <span className="text-[10px] text-ink/55">改完自动保存</span>
              </div>
              <form
                onSubmit={(event) => event.preventDefault()}
                className="mt-2 grid grid-cols-2 gap-2.5"
              >
                <label htmlFor="daily-budget" className={LABEL_CLASS}>
                  日预算（元）
                  <input
                    id="daily-budget"
                    name="dailyBudget"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={dailyInput}
                    onChange={(event) => handleDailyBudget(event.target.value)}
                    onBlur={restoreBudgetInputIfNeeded}
                    aria-describedby="budget-hint"
                    className={FIELD_CLASS}
                  />
                </label>
                <label htmlFor="weekly-budget" className={LABEL_CLASS}>
                  周预算（元）
                  <input
                    id="weekly-budget"
                    name="weeklyBudget"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={weeklyInput}
                    onChange={(event) => handleWeeklyBudget(event.target.value)}
                    onBlur={restoreBudgetInputIfNeeded}
                    aria-describedby="budget-hint"
                    className={FIELD_CLASS}
                  />
                </label>
              </form>
              <p id="budget-hint" className="mt-2 text-[10px] leading-relaxed text-ink/60">
                改日预算，周预算自动 ×7；周预算也可以单独改。
              </p>
            </section>

            <section
              aria-labelledby="wish-setting-heading"
              className="mt-3 rounded-2xl border border-white/70 bg-white/45 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="wish-setting-heading" className="text-sm font-semibold text-ink">
                    大额许愿池
                  </h3>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-ink/60">
                    ≥100 元先进池，冷静 24 小时后确认才记账。
                  </p>
                </div>
                <label className="relative flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    id="wish-pool-toggle"
                    type="checkbox"
                    role="switch"
                    checked={state.settings.wishPoolEnabled}
                    onChange={(event) => handleWishToggle(event.target.checked)}
                    className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <span className="sr-only">大额许愿池</span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none relative h-7 w-12 rounded-full bg-ink/15 transition peer-checked:bg-leaf peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-leaf after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
                  />
                </label>
              </div>
            </section>

            {pendingWishes.length > 0 && (
              <section
                aria-labelledby="pending-wish-heading"
                className="mt-3 rounded-2xl border border-[#EADFC4] bg-[#FBF5E6]/85 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 id="pending-wish-heading" className="text-sm font-semibold text-ink">
                    许愿池
                  </h3>
                  <span className="text-[10px] text-ink/45">{pendingWishes.length} 笔待定</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {pendingWishes.map((wish) => {
                    const ready = isWishReady(wish, now)
                    const countdownId = `wish-countdown-${wish.id}`
                    return (
                      <li
                        key={wish.id}
                        className="rounded-xl border border-white/70 bg-white/60 p-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold text-ink">
                            {categoryName(wish.category)}
                            {wish.note ? ` · ${wish.note}` : ''}
                          </p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                            ¥{formatCents(wish.amountCents)}
                          </p>
                        </div>
                        <p className="mt-0.5 text-[10px] text-ink/55">
                          {formatBillTime(wish.createdAt)} 放进许愿池
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                          <p id={countdownId} className="text-[10px] font-medium text-[#765624]">
                            {ready
                              ? '冷静期结束，可以确认了'
                              : `${formatCountdown(wishRemainingMs(wish, now))} 后可以确认`}
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={!ready}
                              onClick={() => handleConfirmWish(wish.id)}
                              aria-describedby={countdownId}
                              className={`${SMALL_ACTION_CLASS} bg-leaf text-white hover:bg-[#529961] disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/35`}
                            >
                              确认记账
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelWish(wish.id)}
                              className={`${SMALL_ACTION_CLASS} bg-white/80 text-ink/60 hover:bg-white hover:text-ink`}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section aria-labelledby="bills-heading" className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id="bills-heading" className="text-sm font-semibold text-ink">
                  账单
                </h3>
                <span className="text-[10px] text-ink/55">改完统计会同步</span>
              </div>

              <search aria-label="账单筛选" className="mt-2">
                <div className="grid grid-cols-3 gap-2">
                  <label htmlFor="bill-category-filter" className={LABEL_CLASS}>
                    分类
                    <select
                      id="bill-category-filter"
                      value={filters.category}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          category: event.target.value as CategoryId | 'all',
                        }))
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="all">全部分类</option>
                      {CATEGORIES.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="bill-amount-filter" className={LABEL_CLASS}>
                    金额
                    <select
                      id="bill-amount-filter"
                      value={filters.amount}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          amount: event.target.value as AmountFilter,
                        }))
                      }
                      className={FIELD_CLASS}
                    >
                      {AMOUNT_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="bill-time-filter" className={LABEL_CLASS}>
                    时间
                    <select
                      id="bill-time-filter"
                      value={filters.time}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          time: event.target.value as TimeFilter,
                        }))
                      }
                      className={FIELD_CLASS}
                    >
                      {TIME_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </search>

              <div className="mt-3 rounded-2xl border border-white/70 bg-white/50 p-3">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-ink/55">筛选合计</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">
                      ¥{formatCents(filteredTotalCents)}
                    </p>
                  </div>
                  <p className="pb-1 text-[11px] text-ink/55">{filteredTransactions.length} 笔</p>
                </div>
                {categoryTotals.length > 0 ? (
                  <ul className="mt-2.5 grid grid-cols-2 gap-1.5" aria-label="分类统计">
                    {categoryTotals.map((total) => (
                      <li
                        key={total.category}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-2.5 py-1.5"
                      >
                        <span className="min-w-0 truncate text-[10px] text-ink/60">
                          {categoryName(total.category)}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-ink">
                          ¥{formatCents(total.amountCents)}
                          <span className="ml-1 font-normal text-ink/35">{total.pct}%</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-ink/55">这个筛选下还没有账单。</p>
                )}
              </div>

              <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                {filteredTransactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="rounded-2xl border border-white/70 bg-white/55 px-3 py-2.5"
                  >
                    {editingId === transaction.id ? (
                      <form
                        onSubmit={(event) => handleSaveEdit(event, transaction.id)}
                        className="space-y-2"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <label htmlFor={`edit-amount-${transaction.id}`} className={LABEL_CLASS}>
                            金额（元）
                            <input
                              id={`edit-amount-${transaction.id}`}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={editAmount}
                              onChange={(event) => setEditAmount(event.target.value)}
                              className={FIELD_CLASS}
                            />
                          </label>
                          <label
                            htmlFor={`edit-category-${transaction.id}`}
                            className={LABEL_CLASS}
                          >
                            分类
                            <select
                              id={`edit-category-${transaction.id}`}
                              value={editCategory}
                              onChange={(event) =>
                                setEditCategory(event.target.value as CategoryId)
                              }
                              className={FIELD_CLASS}
                            >
                              {CATEGORIES.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label htmlFor={`edit-time-${transaction.id}`} className={LABEL_CLASS}>
                            时间
                            <input
                              id={`edit-time-${transaction.id}`}
                              type="datetime-local"
                              value={editTime}
                              onChange={(event) => setEditTime(event.target.value)}
                              className={FIELD_CLASS}
                            />
                          </label>
                          <label htmlFor={`edit-note-${transaction.id}`} className={LABEL_CLASS}>
                            备注
                            <input
                              id={`edit-note-${transaction.id}`}
                              type="text"
                              maxLength={24}
                              autoComplete="off"
                              value={editNote}
                              onChange={(event) => setEditNote(event.target.value)}
                              className={FIELD_CLASS}
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className={`${SMALL_ACTION_CLASS} bg-ink px-4 text-cream hover:bg-[#25363c]`}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className={`${SMALL_ACTION_CLASS} bg-white/80 text-ink/60 hover:bg-white hover:text-ink`}
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {categoryName(transaction.category)}
                              {transaction.note ? (
                                <span className="font-normal text-ink/55">
                                  {' '}
                                  · {transaction.note}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-[10px] text-ink/55">
                              {formatBillTime(transaction.time)} · 怪物血量{' '}
                              {transaction.monsterHp}
                              {transaction.source === 'wish' ? ' · 许愿确认' : ''}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-[#A94F37]">
                            -{formatCents(transaction.amountCents)} 元
                          </p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-end gap-1">
                          {pendingDeleteId === transaction.id ? (
                            <div
                              role="group"
                              aria-label="确认删除这笔账单"
                              className="flex items-center gap-1.5"
                            >
                              <span className="text-[10px] text-ink/50">真的删掉？</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(transaction.id)}
                                className={`${SMALL_ACTION_CLASS} bg-[#B85C43] text-white hover:bg-[#A34E37]`}
                              >
                                确认删
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className={`${SMALL_ACTION_CLASS} bg-white/80 text-ink/60 hover:bg-white hover:text-ink`}
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => beginEdit(transaction)}
                                className={`${SMALL_ACTION_CLASS} text-ink/55 hover:bg-white/80 hover:text-ink`}
                              >
                                改
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingDeleteId(transaction.id)
                                  setEditingId(null)
                                }}
                                className={`${SMALL_ACTION_CLASS} text-ink/55 hover:bg-[#FBEAE3] hover:text-[#9B4A35]`}
                              >
                                删
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {filteredTransactions.length === 0 && (
                <p className="mt-3 rounded-xl bg-white/45 px-3 py-4 text-center text-[11px] text-ink/55">
                  没有符合条件的账单，换个筛选看看。
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  )
}