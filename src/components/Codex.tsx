import { useEffect, useId, useRef, useState } from 'react'
import { CATEGORIES } from '../data/categories'
import {
  CATALOG,
  CATEGORY_SPIRITS,
  RARITY_COUNTS,
  RARITY_LABEL,
  SPIRIT_BY_ID,
  type Rarity,
  type Spirit,
} from '../data/catalog'
import { getSpiritCollectionSummary, type SpiritCollectionSummary } from '../lib/summon'

const INK = '#2f4147'
const CREAM = '#fffaf0'
const GOLD = '#f5c95d'
const GOLD_DARK = '#b8831f'

const RARITY_CHIP: Record<Rarity, string> = {
  normal: 'bg-ink/10 text-ink/60',
  rare: 'bg-ocean/20 text-[#2a7486]',
  hidden: 'bg-[#f5c95d]/30 text-[#7c5a12]',
}

const DIALOG_STYLES = `
.codex-dialog::backdrop {
  background-color: rgb(47 65 71 / 0.42);
  backdrop-filter: blur(3px);
  overflow: hidden;
  overscroll-behavior: contain;
}
.codex-dialog:modal {
  overscroll-behavior: contain;
}
`

interface SpiritSpriteProps {
  spirit: Spirit
  silhouette?: boolean
  className?: string
}

function FamilyAccessory({
  spirit,
  bodyFill,
  stroke,
  silhouette,
}: {
  spirit: Spirit
  bodyFill: string
  stroke: string
  silhouette: boolean
}) {
  switch (spirit.category) {
    case 'takeout':
      return (
        <g>
          <path
            d="M22 21h20l-2.2 7H24.2Z"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M20.5 20.5h23" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          {!silhouette && (
            <path d="M27 24.6h10" stroke={stroke} strokeWidth="1.2" opacity="0.45" />
          )}
          <path
            d="M35 7.5 31 20"
            stroke={silhouette ? 'currentColor' : '#c97743'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M39 9.5 35.5 20"
            stroke={silhouette ? 'currentColor' : '#c97743'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )
    case 'milk-tea':
      return (
        <g>
          <path
            d="M25 13.5h14l-2 14H27Z"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M23.5 13.5h17" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          {!silhouette && (
            <path d="M28.5 18h7M28.8 21h6.4" stroke={stroke} strokeWidth="1.1" opacity="0.4" />
          )}
          <path
            d="M35.5 5.5 32.6 26"
            stroke={silhouette ? 'currentColor' : '#c97743'}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      )
    case 'night-snack':
      return (
        <g>
          <path
            d="M22.5 19.5c0 6.4 4.2 9.5 9.5 9.5s9.5-3.1 9.5-9.5Z"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M21.5 19.5h21" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path
            d="M26 16.5c1.8-3.2 3.6.8 5.6-2.2s3.6 2 5.6-.8"
            fill="none"
            stroke={silhouette ? 'currentColor' : stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {!silhouette && (
            <g stroke={stroke} strokeWidth="1.2" strokeLinecap="round" opacity="0.5">
              <path d="M26.5 10.5c-1.1-1.6.8-2.6-.1-4.4" />
              <path d="M32 9.5c-1.1-1.6.8-2.6-.1-4.4" />
              <path d="M37.5 10.5c-1.1-1.6.8-2.6-.1-4.4" />
            </g>
          )}
        </g>
      )
    case 'delivery':
      return (
        <g>
          <rect
            x="22"
            y="10.5"
            width="20"
            height="14"
            rx="2.4"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {!silhouette && (
            <>
              <path d="M22 15.5h20" stroke={stroke} strokeWidth="1.1" opacity="0.55" />
              <path d="M32 10.5v14" stroke={GOLD_DARK} strokeWidth="2.2" opacity="0.75" />
              <path
                d="M28 20.5l4-3 4 3"
                fill="none"
                stroke={stroke}
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </>
          )}
        </g>
      )
    case 'transport':
      return (
        <g>
          <path
            d="M20 22c0-8.2 5.1-13 12-13s12 4.8 12 13Z"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M18.8 22h26.4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          {!silhouette && (
            <path
              d="M37 20.5c3.3 0 5.3 1.1 5.3 2.6"
              fill="none"
              stroke={stroke}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.65"
            />
          )}
        </g>
      )
    case 'study':
      return (
        <g>
          <path
            d="M21 21.5V12l11-5 11 5v9.5L32 26Z"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M32 7v19" stroke={stroke} strokeWidth="1.4" />
          {!silhouette && (
            <g stroke={stroke} strokeWidth="1.1" opacity="0.45" strokeLinecap="round">
              <path d="M25 14.5h4M25 17.5h4M36 14.5h4M36 17.5h4" />
            </g>
          )}
        </g>
      )
    case 'daily':
      return (
        <g>
          <rect
            x="22"
            y="13"
            width="20"
            height="12"
            rx="2.4"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path
            d="M27.8 13c-.3-4.2 3-4.8 4.2-1.5 1.2-3.3 4.5-2.6 4.2 1.5"
            fill={silhouette ? 'currentColor' : CREAM}
            stroke={stroke}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {!silhouette && (
            <path d="M29 20h6" stroke={stroke} strokeWidth="1.2" opacity="0.45" />
          )}
        </g>
      )
    case 'fun':
      return (
        <g>
          <path
            d="M22 22c0-8.4 4.3-13 10-13s10 4.6 10 13"
            fill="none"
            stroke={silhouette ? 'currentColor' : stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="17.5"
            y="19.5"
            width="6"
            height="11"
            rx="3"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.4"
          />
          <rect
            x="40.5"
            y="19.5"
            width="6"
            height="11"
            rx="3"
            fill={bodyFill}
            stroke={stroke}
            strokeWidth="1.4"
          />
        </g>
      )
  }
}

export function SpiritSprite({ spirit, silhouette = false, className }: SpiritSpriteProps) {
  const bodyFill = silhouette ? 'currentColor' : spirit.tint
  const stroke = silhouette ? 'currentColor' : spirit.accent
  const accessoryFill = silhouette ? 'currentColor' : CREAM
  const scale = spirit.stage === 1 ? 0.96 : spirit.stage === 3 ? 1.04 : 1

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {!silhouette && spirit.rarity !== 'normal' && (
        <circle
          cx="32"
          cy="36"
          r="29"
          fill="none"
          stroke={spirit.accent}
          strokeWidth={spirit.rarity === 'hidden' ? '1.8' : '1.2'}
          strokeDasharray={spirit.rarity === 'hidden' ? '1 4' : '3 5'}
          opacity="0.55"
        />
      )}

      <g transform={`translate(32 40) scale(${scale}) translate(-32 -40)`}>
        {!silhouette && <ellipse cx="32" cy="57.5" rx="15" ry="2.8" fill={INK} opacity="0.08" />}

        <FamilyAccessory
          spirit={spirit}
          bodyFill={accessoryFill}
          stroke={stroke}
          silhouette={silhouette}
        />

        <path
          d="M14 42c0-12 6.6-20 18-20s18 8 18 20c0 9.6-7.4 14-18 14s-18-4.4-18-14Z"
          fill={bodyFill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {!silhouette && (
          <ellipse cx="24" cy="32" rx="7" ry="4.6" fill={CREAM} opacity="0.3" transform="rotate(-18 24 32)" />
        )}

        {!silhouette && (
          <g>
            <ellipse cx="25.5" cy="40" rx="2.1" ry="2.6" fill={INK} />
            <ellipse cx="38.5" cy="40" rx="2.1" ry="2.6" fill={INK} />
            <circle cx="26.2" cy="39.2" r="0.7" fill={CREAM} />
            <circle cx="39.2" cy="39.2" r="0.7" fill={CREAM} />
            <path
              d="M29 45.8c1.8 1.9 4.2 1.9 6 0"
              fill="none"
              stroke={INK}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <ellipse cx="20.3" cy="45.2" rx="3.1" ry="1.8" fill="#f09a7e" opacity="0.5" />
            <ellipse cx="43.7" cy="45.2" rx="3.1" ry="1.8" fill="#f09a7e" opacity="0.5" />
          </g>
        )}

        {spirit.variant >= 1 && (
          <path
            d="M16.5 35c-3.6-.6-5.5-2.9-5.8-5.8 3.4-.2 6 1.4 7.1 4Z"
            fill={silhouette ? 'currentColor' : '#9bcb8a'}
            stroke={stroke}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        )}
        {spirit.variant >= 2 && (
          <path
            d="m44.5 47.2 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3Z"
            fill={silhouette ? 'currentColor' : GOLD}
            stroke={silhouette ? 'currentColor' : GOLD_DARK}
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        )}
        {spirit.variant >= 3 && (
          <path
            d="M47 7.5h9l-1.5 3.2 2.3 1.4-6.1 2.2-4.6-2 2.4-1.2Z"
            fill={silhouette ? 'currentColor' : GOLD}
            stroke={silhouette ? 'currentColor' : GOLD_DARK}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        )}
      </g>

      {!silhouette && spirit.rarity !== 'normal' && (
        <g fill={GOLD} opacity="0.9">
          <path d="M53 25v5M50.5 27.5h5" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 46v4M8 48h4" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))

function evolutionCopy(spirit: Spirit): string {
  if (!spirit.evolvesTo) return '已是最终形态'
  const target = SPIRIT_BY_ID[spirit.evolvesTo]
  return `形态线索：${target?.name ?? '???'}`
}

export default function Codex() {
  const [summary, setSummary] = useState<SpiritCollectionSummary>(() =>
    getSpiritCollectionSummary(),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const active = activeId ? SPIRIT_BY_ID[activeId] : undefined
  const activeEntry = active ? summary.owned[active.id] : undefined
  const percentage = Math.round((summary.progress / summary.total) * 100)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return

    const isOutside = (event: PointerEvent) => {
      const rect = dialog.getBoundingClientRect()
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
    }
    let pressedOutside = false
    const onPointerDown = (event: PointerEvent) => {
      pressedOutside = isOutside(event)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (pressedOutside && isOutside(event)) dialog.close()
    }

    dialog.addEventListener('pointerdown', onPointerDown)
    dialog.addEventListener('pointerup', onPointerUp)
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown)
      dialog.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (active && dialog && !dialog.open) dialog.showModal()
  }, [active])

  function openDetail(id: string) {
    setSummary(getSpiritCollectionSummary())
    setActiveId(id)
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <style>{DIALOG_STYLES}</style>

      <header>
        <p className="text-[10px] font-semibold tracking-[0.24em] text-leaf">ISLAND CODEX</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">精灵图鉴</h1>
            <p className="mt-1 text-sm text-ink/55">记账会按分类和金额召唤精灵，周蛋还能再孵一只。</p>
          </div>
          <p className="shrink-0 text-lg font-bold text-ink">
            {summary.progress}
            <span className="text-xs font-medium text-ink/40"> / {summary.total}</span>
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="图鉴收集进度"
          aria-valuemin={0}
          aria-valuemax={summary.total}
          aria-valuenow={summary.progress}
          aria-valuetext={`已收集 ${summary.progress} / ${summary.total} 只`}
          className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
        >
          <div
            className="h-full rounded-full bg-leaf transition-[width] duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-ink/10 bg-white/65 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] text-ink/45">精灵来源</p>
            <p className="text-sm font-semibold text-ink">月度结算的蛋</p>
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed text-ink/40">
            每笔记账最多召唤 5 只精灵；重复遇见会累计次数，图鉴按不同精灵计算进度。
          </p>
        </div>
        <p className="mt-2 text-[11px] text-ink/40">
          普通 {RARITY_COUNTS.normal} · 稀有 {RARITY_COUNTS.rare} · 隐藏 {RARITY_COUNTS.hidden}
          ；每月结算最多得 1 枚蛋，记满 3 个自然日孵化。
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {CATEGORIES.map((category) => {
          const spirits = CATEGORY_SPIRITS[category.id]
          const ownedCount = spirits.filter((spirit) => summary.owned[spirit.id]).length
          return (
            <section
              key={category.id}
              aria-labelledby={`codex-${category.id}`}
              className="rounded-3xl border border-ink/10 bg-white/55 p-3"
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 id={`codex-${category.id}`} className="text-sm font-semibold text-ink">
                  {category.name}
                </h2>
                <span className="text-[11px] text-ink/40">
                  {ownedCount} / {spirits.length}
                </span>
              </div>
              <ul className="grid grid-cols-4 gap-1.5">
                {spirits.map((spirit) => {
                  const entry = summary.owned[spirit.id]
                  return (
                    <li key={spirit.id}>
                      <button
                        type="button"
                        onClick={() => openDetail(spirit.id)}
                        aria-haspopup="dialog"
                        aria-label={
                          entry
                            ? `${spirit.name}，${RARITY_LABEL[spirit.rarity]}，已收集，查看详情`
                            : '未收集的精灵，点击查看线索'
                        }
                        data-spirit-id={spirit.id}
                        data-owned={entry ? 'true' : 'false'}
                        className="flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-colors hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-leaf"
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center ${
                            entry ? '' : 'text-ink/20'
                          }`}
                        >
                          <SpiritSprite
                            spirit={spirit}
                            silhouette={!entry}
                            className="h-11 w-11"
                          />
                        </span>
                        <span
                          className={`w-full truncate text-center text-[10px] leading-tight ${
                            entry ? 'font-medium text-ink' : 'text-ink/30'
                          }`}
                        >
                          {entry ? spirit.name : '？？？'}
                        </span>
                        <span className="h-3 text-[9px] leading-3 text-ink/40">
                          {entry && entry.count > 1 ? `×${entry.count}` : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setActiveId(null)}
        className="codex-dialog m-auto w-[min(21rem,calc(100vw-2rem))] rounded-3xl border border-ink/10 bg-cream p-0 text-ink shadow-2xl"
        {...({ closedby: 'any' } as Record<string, string>)}
      >
        {active && (
          <div className="max-h-[85vh] overflow-y-auto p-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${active.tint}33` }}
              >
                <SpiritSprite
                  spirit={active}
                  silhouette={!activeEntry}
                  className={`h-16 w-16 ${activeEntry ? '' : 'text-ink/20'}`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] tracking-[0.18em] text-ink/40">
                  No.{String(CATALOG.findIndex((spirit) => spirit.id === active.id) + 1).padStart(2, '0')}
                </p>
                <h2 id={titleId} className="mt-0.5 truncate text-lg font-bold">
                  {activeEntry ? active.name : '？？？'}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] text-ink/60">
                    {CATEGORY_NAMES.get(active.category)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      activeEntry ? RARITY_CHIP[active.rarity] : 'bg-ink/10 text-ink/45'
                    }`}
                  >
                    {activeEntry ? RARITY_LABEL[active.rarity] : '未收集'}
                  </span>
                </div>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-xs">
              <div>
                <dt className="font-semibold text-ink/45">图鉴线索</dt>
                <dd className="mt-0.5 leading-relaxed text-ink/75">{active.hint}</dd>
              </div>
              <div className="flex gap-6">
                <div>
                  <dt className="font-semibold text-ink/45">获得次数</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {activeEntry ? `${activeEntry.count} 次` : '还没获得'}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-semibold text-ink/45">进化</dt>
                  <dd className="mt-0.5 text-ink/75">
                    {evolutionCopy(active)}
                  </dd>
                </div>
              </div>
            </dl>

            <form method="dialog" className="mt-6">
              <button
                autoFocus
                className="h-11 w-full rounded-2xl bg-ink text-sm font-semibold text-cream transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              >
                关闭
              </button>
            </form>
          </div>
        )}
      </dialog>
    </div>
  )
}
