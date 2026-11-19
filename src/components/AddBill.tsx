import { useRef, useState, type FormEvent } from 'react'
import { CATEGORIES } from '../data/categories'
import {
  calcHpCost,
  formatYuan,
  toDateTimeLocalValue,
  type Bill,
  type NewBillInput,
} from '../lib/island'
import type { CategoryId } from '../types'

interface AddBillProps {
  onAdd: (input: NewBillInput) => Bill
}

export default function AddBill({ onAdd }: AddBillProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [note, setNote] = useState('')
  const [time, setTime] = useState(() => toDateTimeLocalValue())
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLFieldSetElement>(null)

  const amountValue = Number(amount)
  const hpPreview =
    Number.isFinite(amountValue) && amountValue > 0 ? calcHpCost(amountValue) : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('先填一个大于 0 的金额')
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
      const bill = onAdd({
        amount: amountValue,
        category,
        note,
        time: new Date(time).toISOString(),
      })
      setFeedback(`已记账：${formatYuan(bill.amount)} 元 · 岛扣 ${bill.hpCost} 点血`)
      setAmount('')
      setNote('')
      setCategory(null)
      setTime(toDateTimeLocalValue())
    } catch (err) {
      setError(err instanceof Error ? err.message : '记账失败，再试一次')
    }
  }

  return (
    <section className="rounded-3xl border border-ink/10 bg-white/75 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">记一笔</h2>
        <span className="text-[11px] text-ink/40">1 点血 = 15 元</span>
      </div>

      <form aria-label="记一笔" className="mt-3 grid gap-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-[11px] font-medium text-ink/45">金额（元）</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 focus-within:border-leaf">
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
            {hpPreview !== null && (
              <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[11px] font-medium text-ink/50">
                扣 {hpPreview} 点血
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
            className="mt-1.5 h-12 w-full rounded-xl border border-ink/10 bg-white px-3 text-base text-ink outline-none focus:border-leaf"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-medium text-ink/45">时间</span>
          <input
            type="datetime-local"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            className="mt-1.5 h-12 w-full rounded-xl border border-ink/10 bg-white px-3 text-base text-ink outline-none focus:border-leaf"
          />
        </label>

        <button
          type="submit"
          className="h-12 rounded-xl bg-leaf text-sm font-semibold text-white transition-colors hover:bg-[#549A5F]"
        >
          记下这一笔
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
