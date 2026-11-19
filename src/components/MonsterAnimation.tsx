import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../data/categories'
import { WISH_THRESHOLD_CENTS } from '../data/constants'
import type { Spirit } from '../data/catalog'
import type { Bill } from '../lib/island'
import { formatCents } from '../lib/money'
import { getGuardian } from '../lib/summon'
import { SpiritSprite } from './Codex'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))

const ANIMATION_STYLES = `
.ma-card { animation: ma-card-in 260ms ease-out both; }
.ma-guardian { animation: ma-lunge 900ms ease-in-out 300ms both; }
.ma-monster { animation: ma-walk-in 820ms cubic-bezier(.2,.8,.3,1) both; }
.ma-monster-inner { animation: ma-bob 1.4s ease-in-out 820ms infinite; }
.ma-impact { animation: ma-impact 620ms ease-out 720ms both; }
.ma-hp { transition: width 820ms cubic-bezier(.4,0,.2,1); }
@keyframes ma-card-in {
  from { opacity: 0; transform: translateY(14px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ma-walk-in {
  0% { opacity: 0; transform: translateX(96px) rotate(7deg); }
  15% { opacity: 1; }
  60% { transform: translateX(-6px) rotate(-2deg); }
  100% { opacity: 1; transform: translateX(0) rotate(0); }
}
@keyframes ma-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes ma-lunge {
  0%, 32% { transform: translateX(0) rotate(0); }
  48% { transform: translateX(26px) rotate(-9deg); }
  64% { transform: translateX(0) rotate(0); }
  100% { transform: translateX(0); }
}
@keyframes ma-impact {
  0% { opacity: 0; transform: scale(.3) rotate(-18deg); }
  30% { opacity: 1; transform: scale(1.15) rotate(6deg); }
  70% { opacity: 1; transform: scale(.95) rotate(0); }
  100% { opacity: 0; transform: scale(1.35); }
}
@media (prefers-reduced-motion: reduce) {
  .ma-card, .ma-guardian, .ma-monster, .ma-monster-inner, .ma-impact { animation: none; }
  .ma-hp { transition: none; }
}
`

interface MonsterAnimationProps {
  monster: Spirit
  bill: Bill
  hpBefore: number
  hpAfter: number
  onDone: () => void
}

function IslandGuardian() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="h-full w-full">
      <ellipse cx="32" cy="57" rx="14" ry="2.6" fill="#2f4147" opacity="0.08" />
      <path
        d="M16 41c0-10.5 6.2-17 16-17s16 6.5 16 17c0 8.4-6.6 12.4-16 12.4S16 49.4 16 41Z"
        fill="#9bcb8a"
        stroke="#5fa96b"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M32 25c-.6-6 2.3-9.4 8.4-10.4-1 5.8-4 9.3-8.4 10.4Z"
        fill="#5fa96b"
        stroke="#3f7d4c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <ellipse cx="26.2" cy="41" rx="2" ry="2.5" fill="#2f4147" />
      <ellipse cx="37.8" cy="41" rx="2" ry="2.5" fill="#2f4147" />
      <circle cx="26.8" cy="40.2" r="0.65" fill="#fffaf0" />
      <circle cx="38.4" cy="40.2" r="0.65" fill="#fffaf0" />
      <path
        d="M29 46.4c1.7 1.8 4.3 1.8 6 0"
        fill="none"
        stroke="#2f4147"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <ellipse cx="21.4" cy="45.6" rx="2.8" ry="1.6" fill="#f09a7e" opacity="0.5" />
      <ellipse cx="42.6" cy="45.6" rx="2.8" ry="1.6" fill="#f09a7e" opacity="0.5" />
    </svg>
  )
}

export default function MonsterAnimation({
  monster,
  bill,
  hpBefore,
  hpAfter,
  onDone,
}: MonsterAnimationProps) {
  const [drained, setDrained] = useState(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const drainTimer = window.setTimeout(() => setDrained(true), 700)
    const closeTimer = window.setTimeout(() => onDoneRef.current(), 2800)
    return () => {
      window.clearTimeout(drainTimer)
      window.clearTimeout(closeTimer)
    }
  }, [])

  const guardian = getGuardian(monster.id)
  const hpDelta = Math.max(0, hpBefore - hpAfter)
  const barWidth = Math.max(0, Math.min(100, drained ? hpAfter : hpBefore))
  const headline = `怪物来袭 · ${monster.name}`
  const subline =
    bill.source === 'wish' && bill.amountCents >= WISH_THRESHOLD_CENTS
      ? '愿望确认后，这笔大额消费变成了 Boss；守岛精灵迎了上去。'
      : bill.source === 'wish'
        ? '愿望确认后，这笔计划消费变成正式账单；守岛精灵迎了上去。'
        : '这笔账单召唤出消费怪物，守岛精灵挡在前面。怪物只参与攻岛，不进图鉴。'

  return (
    <div
      role="status"
      aria-live="polite"
      data-monster-animation
      data-monster-id={monster.id}
      data-hp-before={hpBefore}
      data-hp-after={hpAfter}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-4"
    >
      <style>{ANIMATION_STYLES}</style>
      <div className="ma-card relative w-full max-w-md overflow-hidden rounded-3xl border border-ink/10 bg-cream/95 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={onDone}
          aria-label="收起怪物动画"
          className="pointer-events-auto absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-base leading-none text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          ×
        </button>

        <div className="relative h-24 overflow-hidden bg-gradient-to-b from-[#e3f2f0] via-[#eaf5e4] to-[#f2d9a6]/70">
          <div className="absolute inset-x-0 bottom-0 h-6 rounded-t-[50%] bg-[#9bcb8a]/45" />
          <div className="absolute bottom-1 left-6 h-2 w-8 rounded-full bg-white/40" />
          <div className="absolute bottom-2 right-10 h-1.5 w-6 rounded-full bg-white/35" />

          <div className="ma-guardian absolute bottom-2 left-[15%] h-14 w-14">
            {guardian ? (
              <SpiritSprite spirit={guardian} className="h-full w-full" />
            ) : (
              <IslandGuardian />
            )}
          </div>

          <div className="ma-monster absolute bottom-1.5 right-[17%] h-16 w-16">
            <div className="ma-monster-inner h-full w-full">
              <SpiritSprite spirit={monster} className="h-full w-full" />
            </div>
          </div>

          <div className="ma-impact absolute bottom-7 left-1/2 -translate-x-1/2">
            <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9">
              <path
                d="M20 2l3.4 10.2L33 8.6l-5.4 9.1L38 20l-10.4 2.3 5.4 9.1-9.6-3.6L20 38l-3.4-10.2L7 31.4l5.4-9.1L2 20l10.4-2.3L7 8.6l9.6 3.6Z"
                fill="#f5c95d"
                stroke="#c99325"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="20" cy="20" r="4.2" fill="#fffaf0" stroke="#c99325" strokeWidth="1" />
            </svg>
          </div>
        </div>

        <div className="px-4 pb-3 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-leaf">
              {bill.source === 'wish' ? 'WISH CONFIRMED' : 'MONSTER ENCOUNTER'}
            </p>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-ink/55">
              {CATEGORY_NAMES.get(bill.category)} · {formatCents(bill.amountCents)} 元
            </span>
          </div>

          <p className="mt-1 pr-8 text-sm font-semibold leading-snug text-ink">{headline}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink/50">{subline}</p>

          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-[10px] font-medium text-ink/45">岛血</span>
            <div
              role="progressbar"
              aria-label="岛血量"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={hpAfter}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
            >
              <div
                className="ma-hp h-full rounded-full bg-leaf"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-ink/45">
              {hpBefore} → {hpAfter}
            </span>
            {hpDelta > 0 && (
              <span className="shrink-0 rounded-full bg-[#f09a7e]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#a8553b]">
                -{hpDelta}
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[10px] text-ink/35">
            按本月累计支出统一扣血，与账单笔数无关；怪物只出场，不增加精灵收藏。
          </p>
        </div>
      </div>
    </div>
  )
}
