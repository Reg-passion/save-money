import { useEffect, useState } from 'react'
import { CATEGORIES } from '../data/categories'
import { formatBillTime } from '../lib/island'
import { formatCents } from '../lib/money'
import { isWishReady, wishRemainingMs, type WishRecord } from '../lib/wish'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))

interface WishPoolProps {
  wishes: WishRecord[]
  onConfirm: (wishId: string) => void
  onCancel: (wishId: string) => void
}

function countdownLabel(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function WishPool({ wishes, onConfirm, onCancel }: WishPoolProps) {
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const pending = wishes.filter((wish) => wish.status === 'pending')

  useEffect(() => {
    if (pending.length === 0) return
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [pending.length])

  if (pending.length === 0) return null

  function run(action: () => void) {
    setError(null)
    try {
      action()
    } catch (err) {
      setError(err instanceof Error ? err.message : '许愿池操作失败')
    }
  }

  return (
    <section className="rounded-3xl border border-[#E9D08A] bg-[#FFFCF0] p-4" aria-labelledby="wish-title">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-[#9A7624]">WISH POOL</p>
          <h2 id="wish-title" className="mt-1 text-sm font-bold text-ink">
            许愿池
          </h2>
          <p className="mt-1 text-[10px] leading-relaxed text-ink/40">
            计划购买先放这里，冷静 24 小时后才能转成正式账单。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-medium text-[#8A6415]">
          {pending.length} 个待确认
        </span>
      </header>

      {error && (
        <p role="status" className="mt-3 rounded-2xl bg-[#FBE3DD] px-3 py-2 text-[11px] text-[#A34A38]">
          {error}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {pending.map((wish) => {
          const ready = isWishReady(wish, now)
          return (
            <li key={wish.id} className="rounded-2xl border border-[#E9D08A]/70 bg-white/65 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {formatCents(wish.amountCents)} 元 · {CATEGORY_NAMES.get(wish.category) ?? '杂项'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink/45">
                    {wish.note || '未写备注'} · 创建于 {formatBillTime(wish.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    ready ? 'bg-[#EDF6E5] text-[#4F7B39]' : 'bg-ink/5 text-ink/45'
                  }`}
                >
                  {ready ? '可以确认' : countdownLabel(wishRemainingMs(wish, now))}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => run(() => onConfirm(wish.id))}
                  className="h-10 rounded-xl bg-leaf text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
                >
                  确认入账
                </button>
                <button
                  type="button"
                  onClick={() => run(() => onCancel(wish.id))}
                  className="h-10 rounded-xl border border-ink/15 bg-white/70 text-xs font-medium text-ink/60 transition-colors hover:bg-white"
                >
                  取消愿望
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
