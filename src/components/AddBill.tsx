import { useRef, useState, type FormEvent } from 'react'
import { SPIRIT_BY_ID } from '../data/catalog'
import { CATEGORIES } from '../data/categories'
import type { ExpenseOutcome } from '../lib/expense'
import { toDateTimeLocalValue, type NewBillInput } from '../lib/island'
import { formatCents, parseYuanToCents } from '../lib/money'
import type { CategoryId } from '../types'

interface AddBillProps {
  onAdd: (input: NewBillInput, planned: boolean) => ExpenseOutcome
}

export default function AddBill({ onAdd }: AddBillProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [note, setNote] = useState('')
  const [time, setTime] = useState(() => toDateTimeLocalValue())
  const [planned, setPlanned] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLFieldSetElement>(null)

  const amountCents = parseYuanToCents(amount)
  const goesToWish = planned

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    if (amountCents === null) {
      setError('先填一个大于 0、最多两位小数的金额')
      amountRef.current?.focus()
      return
    }
    if (!category) {
      setError('选一个分类')
      categoryRef.current?.querySelector('button')?.focus()
      return
    }
    if (!time) {
      setError('选一个时间')
      return
    }

    try {
      const outcome = onAdd(
        {
          amountCents,
          category,
          note,
          time: new Date(time).toISOString(),
        },
        planned,
      )
      if (outcome.kind === 'wish') {
        setFeedback(
          `已放入许愿池：${formatCents(outcome.wish.amountCents)} 元。24 小时后才能确认入账，也可以提前取消。`,
        )
      } else if (outcome.bill.summonOutcome === 'energy') {
        setFeedback(
          `已记账：${formatCents(outcome.bill.amountCents)} 元。今天的 5 只精灵已经召唤满，这一笔只增加岛屿能量。`,
        )
      } else {
        const spirit = outcome.bill.summonedSpiritId
          ? SPIRIT_BY_ID[outcome.bill.summonedSpiritId]
          : null
        setFeedback(
          spirit
            ? `已记账：${formatCents(outcome.bill.amountCents)} 元，${outcome.bill.spiritIsNew ? `新精灵「${spirit.name}」已进图鉴。` : `再次遇见「${spirit.name}」，出现次数 +1。`}`
            : `已记账：${formatCents(outcome.bill.amountCents)} 元。`,
        )
      }
      setAmount('')
      setNote('')
      setCategory(null)
      setPlanned(false)
      setTime(toDateTimeLocalValue())
    } catch (err) {
      setError(err instanceof Error ? err.message : '记账失败，再试一次')
    }
  }

  return (
    <section className="glass-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">记一笔</h2>
        <span className="text-[11px] text-ink/40">月累计扣血 · 1 点 = 15 元</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-ink/35">
        已发生的消费立即记账；标记为「计划购买」时，先进许愿池冷静 24 小时，确认后才会成为正式账单。
      </p>

      <form aria-label="记一笔" className="mt-3 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="消费类型">
          <button
            type="button"
            aria-pressed={!planned}
            onClick={() => setPlanned(false)}
            className={`h-10 rounded-xl text-xs font-medium transition-colors ${
              !planned ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60 hover:bg-ink/10'
            }`}
          >
            已发生
          </button>
          <button
            type="button"
            aria-pressed={planned}
            onClick={() => setPlanned(true)}
            className={`h-10 rounded-xl text-xs font-medium transition-colors ${
              planned ? 'bg-[#D9B25F] text-white' : 'bg-ink/5 text-ink/60 hover:bg-ink/10'
            }`}
          >
            计划购买
          </button>
        </div>
        <label className="block">
          <span className="text-[11px] font-medium text-ink/45">金额（元）</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 focus-within:border-leaf">
            <span className="text-sm font-semibold text-ink/40">¥</span>
            <input
              ref={amountRef}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              required
              className="w-full min-w-0 bg-transparent text-2xl font-bold text-ink outline-none placeholder:text-ink/20"
            />
            {amountCents !== null && (
              <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[11px] font-medium text-ink/50">
                {goesToWish ? '先进许愿池' : '按本月累计扣血'}
              </span>
            )}
          </div>
        </label>

        <fieldset ref={categoryRef}>
          <legend className="text-[11px] font-medium text-ink/45">分类</legend>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
                className={`h-12 rounded-xl text-xs font-medium transition-colors ${
                  category === item.id
                    ? 'bg-leaf text-white'
                    : 'bg-ink/5 text-ink/60 hover:bg-ink/10'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-[11px] font-medium text-ink/45">备注（可选）</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="比如：三分糖、和室友拼单"
            className="mt-1.5 h-12 w-full rounded-xl border border-white/70 bg-white/80 px-3 text-base text-ink outline-none focus:border-leaf"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-medium text-ink/45">时间</span>
          <input
            type="datetime-local"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            className="mt-1.5 h-12 w-full rounded-xl border border-white/70 bg-white/80 px-3 text-base text-ink outline-none focus:border-leaf"
          />
        </label>

        <button
          type="submit"
          className={`h-12 rounded-xl text-sm font-semibold text-white transition-colors ${
            goesToWish ? 'bg-[#C9A24A] hover:bg-[#B8933F]' : 'bg-leaf hover:bg-[#549A5F]'
          }`}
        >
          {goesToWish ? '放进许愿池' : '记下这一笔'}
        </button>

        <p
          className={`min-h-4 text-center text-[11px] ${error ? 'text-[#B14E3D]' : 'text-leaf'}`}
          role="status"
        >
          {error ?? feedback ?? ''}
        </p>
      </form>
    </section>
  )
}
