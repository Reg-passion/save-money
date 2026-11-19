import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../data/categories'
import { RARITY_LABEL } from '../data/catalog'
import { formatYuan, type Bill } from '../lib/island'
import { getGuardian, type SummonResult } from '../lib/summon'
import { SpiritSprite } from './Codex'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))

const ANIMATION_STYLES = `
.ma-card { animation: ma-card-in 260ms ease-out both; }
.ma-guardian { animation: ma-lunge 900ms ease-in-out 300ms both; }
.ma-monster { animation: ma-walk-in 820ms cubic-bezier(.2,.8,.3,1) both; }
.ma-monster-inner { animation: ma-bob 1.4s ease-in-out 820ms infinite; }
.ma-impact { animation: ma-impact 620ms ease-out 720ms both; }
.ma-hp { transition: width 820ms cubic-bezier(.4,0,.2,1); }
.ma-evolve-old { animation: ma-fade-out 520ms ease-in 760ms both; }
.ma-evolve-new { animation: ma-pop-in 720ms cubic-bezier(.2,.9,.3,1.25) 980ms both; }
.ma-orb { animation: ma-float 1.7s ease-in-out infinite; }
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
@keyframes ma-fade-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(.7) rotate(-8deg); }
}
@keyframes ma-pop-in {
  0% { opacity: 0; transform: scale(.2) rotate(10deg); }
  55% { opacity: 1; transform: scale(1.18) rotate(-3deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes ma-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@media (prefers-reduced-motion: reduce) {
  .ma-card, .ma-guardian, .ma-monster, .ma-monster-inner, .ma-impact,
  .ma-evolve-old, .ma-evolve-new, .ma-orb { animation: none; }
  .ma-hp { transition: none; }
  .ma-evolve-old { opacity: 0; }
}
`

interface MonsterAnimationProps {
  result: SummonResult
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

function SummonedEmblem({ kind }: { kind: 'energy' | 'wish' }) {
  if (kind === 'energy') {
    return (
      <div className="ma-orb flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#bfe4ea] to-[#7fc8d9] shadow-inner">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7">
          <path
            d="M17.5 3 8 18h6.5L14 29l9.5-15.5H17Z"
            fill="#fffaf0"
            stroke="#2f4147"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }
  return (
    <div className="ma-orb flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ffe2a8] to-[#f5c95d] shadow-inner">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7">
        <circle cx="16" cy="16" r="10" fill="#fffaf0" stroke="#b8831f" strokeWidth="1.4" />
        <path
          d="M16 9.5v13M12.8 12.4h5.4a2.4 2.4 0 1 1 0 4.8h-4.4a2.4 2.4 0 1 0 0 4.8h5.6"
          fill="none"
          stroke="#b8831f"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function MonsterAnimation({
  result,
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

  const spirit = result.spirit
  const evolvedTo = result.evolvedTo
  const guardian = getGuardian(spirit?.id)
  const isFight = result.kind === 'new' || result.kind === 'duplicate' || result.kind === 'evolve'
  const hpDelta = Math.max(0, hpBefore - hpAfter)
  const barWidth = Math.max(0, Math.min(100, drained ? hpAfter : hpBefore))

  let headline = ''
  let subline = ''
  if (result.kind === 'new' && spirit) {
    headline = `新岛民：${spirit.name}`
    subline = '精灵从账单里跳出来，图鉴 +1。'
  } else if (result.kind === 'duplicate' && spirit) {
    headline = `又遇见 ${spirit.name}`
    subline = `第 ${result.count ?? 2} 次相遇，重复的相遇也会被记住。`
  } else if (result.kind === 'evolve' && spirit && evolvedTo) {
    headline = `进化成功！${spirit.name} → ${evolvedTo.name}`
    subline = '三次相遇的缘分，长成了新形态。'
  } else if (result.kind === 'energy') {
    headline = `今日召唤已满 ${result.dailyLimit} 只`
    subline = `多记的这笔账化作 +${result.energyGained} 岛屿能量。`
  } else {
    headline = '大额支出 · 许愿池待开放'
    subline = '单笔 ≥100 元先不召唤精灵，愿望等许愿池上线再兑现。'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-monster-animation
      data-kind={result.kind}
      data-spirit-id={result.spirit?.id ?? ''}
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

          {isFight && spirit ? (
            <>
              <div className="ma-guardian absolute bottom-2 left-[15%] h-14 w-14">
                {guardian ? (
                  <SpiritSprite spirit={guardian} className="h-full w-full" />
                ) : (
                  <IslandGuardian />
                )}
              </div>

              <div className="ma-monster absolute bottom-1.5 right-[17%] h-16 w-16">
                <div className="ma-monster-inner h-full w-full">
                  <div className={`relative h-full w-full ${result.kind === 'evolve' ? 'ma-evolve-old' : ''}`}>
                    <SpiritSprite spirit={spirit} className="h-full w-full" />
                  </div>
                  {result.kind === 'evolve' && evolvedTo && (
                    <div className="ma-evolve-new absolute inset-0">
                      <SpiritSprite spirit={evolvedTo} className="h-full w-full" />
                    </div>
                  )}
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
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <SummonedEmblem kind={result.kind === 'wish' ? 'wish' : 'energy'} />
            </div>
          )}
        </div>

        <div className="px-4 pb-3 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-leaf">
              {result.kind === 'energy'
                ? 'ISLAND ENERGY'
                : result.kind === 'wish'
                  ? 'WISH POOL'
                  : 'MONSTER ENCOUNTER'}
            </p>
            {spirit ? (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-ink/55">
                {RARITY_LABEL[spirit.rarity]}
              </span>
            ) : (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-ink/55">
                {CATEGORY_NAMES.get(bill.category)} · {formatYuan(bill.amount)} 元
              </span>
            )}
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

          {isFight && spirit && (
            <p className="mt-1.5 text-[10px] text-ink/35">
              图鉴进度 {result.progress} / 32
              {result.kind !== 'evolve' && result.count && result.count > 1
                ? ` · 第 ${result.count} 次相遇`
                : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
