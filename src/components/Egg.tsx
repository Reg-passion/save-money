import { useId, useState } from 'react'
import { RARITY_LABEL, SPIRIT_BY_ID } from '../data/catalog'
import { EGG_HATCH_DAYS } from '../data/constants'
import {
  EGG_TIER_LABEL,
  formatPercent,
  type EggRecord,
  type HatchResult,
} from '../lib/egg'
import { formatCents } from '../lib/money'
import type { EggTier } from '../types'
import { SpiritSprite } from './Codex'

const TIER_CHIP: Record<EggTier, string> = {
  normal: 'bg-[#F4EAD7] text-[#8A6A3C]',
  silver: 'bg-[#E8EFF2] text-[#566E78]',
  gold: 'bg-[#FBEDC0] text-[#8E6415]',
}

const TIER_CARD: Record<EggTier, string> = {
  normal: 'border-[#E7D7B8] bg-[#FFFDF7]',
  silver: 'border-[#CBD9DE] bg-[#F8FBFC]',
  gold: 'border-[#E9D08A] bg-[#FFFCF0]',
}

const SHELL_COLORS: Record<
  EggTier,
  { shell: string; stroke: string; spot: string; shine: string }
> = {
  normal: { shell: '#FFF8E7', stroke: '#D9C59A', spot: '#E7D2A8', shine: '#FFFDF7' },
  silver: { shell: '#EDF3F5', stroke: '#A8BCC4', spot: '#C9D8DD', shine: '#FFFFFF' },
  gold: { shell: '#FFF1C2', stroke: '#D4A63E', spot: '#E8C46A', shine: '#FFF9DF' },
}

function EggShell({ tier, progress }: { tier: EggTier; progress: number }) {
  const colors = SHELL_COLORS[tier]

  return (
    <svg
      viewBox="0 0 120 150"
      className="h-auto w-full animate-float-soft"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="60" cy="139" rx="29" ry="5" fill="#2F4147" opacity="0.08" />
      <path
        d="M60 12c18.2 0 34 24.4 34 55.5 0 33.2-15.2 58.5-34 58.5S26 100.7 26 67.5C26 36.4 41.8 12 60 12Z"
        fill={colors.shell}
        stroke={colors.stroke}
        strokeWidth="2.4"
      />
      <ellipse
        cx="44"
        cy="38"
        rx="11"
        ry="18"
        fill={colors.shine}
        opacity="0.8"
        transform="rotate(24 44 38)"
      />
      <g fill={colors.spot}>
        <circle cx="78" cy="42" r="3.2" />
        <circle cx="86" cy="58" r="1.8" />
        <circle cx="72" cy="72" r="2.2" />
        <circle cx="48" cy="88" r="2.6" />
        <circle cx="60" cy="108" r="1.8" />
        <circle cx="80" cy="96" r="1.5" />
      </g>
      {tier === 'silver' && (
        <g fill="none" stroke={colors.stroke} strokeWidth="1.2" opacity="0.55">
          <path d="M78 28v5M75.5 30.5h5" />
          <path d="M38 76v4M36 78h4" />
        </g>
      )}
      {tier === 'gold' && (
        <g fill="#D4A63E" opacity="0.75">
          <path d="m82 74 1.6 3.4 3.7.5-2.7 2.5.7 3.7-3.3-1.9-3.3 1.9.7-3.7-2.7-2.5 3.7-.5Z" />
          <path d="M40 115v4M38 117h4" stroke="#D4A63E" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      )}
      {progress >= 1 && (
        <path
          d="m61 46 7 7-5 8 7 6"
          fill="none"
          stroke="#7A5C3C"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      )}
      {progress >= 2 && (
        <path
          d="m82 81-8 5 5 8-10 5m-12 7 5 7-4 7"
          fill="none"
          stroke="#7A5C3C"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      )}
      {progress >= 3 && (
        <path
          d="m38 69 8 5-5 7 7 6"
          fill="none"
          stroke="#7A5C3C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      )}
    </svg>
  )
}

function HatchBanner({
  result,
  demo,
  onClose,
}: {
  result: HatchResult
  demo: boolean
  onClose: () => void
}) {
  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-3 rounded-2xl border border-leaf/30 bg-[#F1F8EA] p-3"
    >
      <SpiritSprite spirit={result.spirit} className="h-12 w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">
          孵化成功 · {result.spirit.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink/50">
          {RARITY_LABEL[result.spirit.rarity]}精灵 ·{' '}
          {demo
            ? '演示结果，不会写入正式图鉴'
            : result.isNew
              ? '已加入图鉴'
              : '图鉴里已经有它了'}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭孵化结果"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink/60"
      >
        ×
      </button>
    </div>
  )
}

interface EggProps {
  eggs: EggRecord[]
  variant?: 'formal' | 'demo'
  onDemoHatch?: (eggId: string) => HatchResult | null
}

export default function Egg({ eggs, variant = 'formal', onDemoHatch }: EggProps) {
  const [result, setResult] = useState<HatchResult | null>(null)
  const titleId = useId()
  const demo = variant === 'demo'

  function handleDemoHatch(eggId: string) {
    if (!onDemoHatch) return
    const next = onDemoHatch(eggId)
    if (!next) return
    setResult(next)
  }

  const waitingCount = eggs.filter((egg) => !egg.hatched).length

  return (
    <section
      className="glass-panel mt-4 p-4"
      aria-labelledby={titleId}
      data-egg-variant={variant}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-ink/35">
            {demo ? 'DEMO NEST' : 'EGG NEST'}
          </p>
          <h3 id={titleId} className="mt-1 text-sm font-bold text-ink">
            {demo ? '演示孵化栏' : '孵化栏'}
            {demo && (
              <span className="ml-1.5 rounded-full bg-ink/5 px-2 py-0.5 align-middle text-[10px] font-medium text-ink/40">
                不写正式数据
              </span>
            )}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-ink/50">
          {waitingCount > 0
            ? `${waitingCount} 枚待孵`
            : eggs.length > 0
              ? `${eggs.length} 枚已孵化`
              : '暂时空着'}
        </span>
      </div>

      {result && (
        <div className="mt-3">
          <HatchBanner result={result} demo={demo} onClose={() => setResult(null)} />
        </div>
      )}

      {eggs.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white/45 px-4 py-6 text-center text-xs leading-relaxed text-ink/45">
          {demo
            ? '演示结算产生的蛋会放在这里，可随时重置，不影响正式结算与图鉴。'
            : '还没有蛋。月底岛血 > 0 且没有超预算，会收到 1 枚蛋。'}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {eggs.map((egg) => {
            const progress = Math.min(EGG_HATCH_DAYS, egg.hatchDays.length)
            const spirit = egg.spiritId ? SPIRIT_BY_ID[egg.spiritId] : null

            if (egg.hatched) {
              return (
                <li key={egg.id} className="rounded-2xl border border-ink/10 bg-white/55 p-3">
                  <div className="flex items-center gap-3">
                    {spirit ? (
                      <SpiritSprite spirit={spirit} className="h-14 w-14 shrink-0" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-semibold text-ink/30">
                        蛋
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-semibold text-ink">
                          {spirit ? `孵化成功 · ${spirit.name}` : '孵化成功'}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TIER_CHIP[egg.tier]}`}>
                          {EGG_TIER_LABEL[egg.tier]}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink/45">
                        {spirit ? `${RARITY_LABEL[spirit.rarity]}精灵 · ` : ''}
                        {egg.monthLabel} · 稀有判定 {formatPercent(egg.rareChance)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-leaf">
                        {demo
                          ? '演示记录 · 不会加入正式图鉴'
                          : egg.isNewSpirit === null
                            ? '孵化记录已保存'
                            : egg.isNewSpirit
                              ? '已加入图鉴'
                              : '图鉴里已经有它了'}
                      </p>
                    </div>
                  </div>
                </li>
              )
            }

            return (
              <li
                key={egg.id}
                className={`rounded-2xl border p-3 ${TIER_CARD[egg.tier]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-20 shrink-0">
                    <EggShell tier={egg.tier} progress={progress} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_CHIP[egg.tier]}`}>
                        {EGG_TIER_LABEL[egg.tier]}
                      </span>
                      <span className="text-[10px] text-ink/40">{egg.monthLabel}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink/55">
                      已省 <b className="font-semibold text-ink">{formatCents(egg.savedCents)} 元</b> · 稀有判定{' '}
                      <b className="font-semibold text-ink">{formatPercent(egg.rareChance)}</b>
                    </p>
                    <div className="mt-2 flex items-baseline justify-between text-[10px] text-ink/45">
                      <span>蛋壳裂缝</span>
                      <span>
                        {progress} / {EGG_HATCH_DAYS} 天
                      </span>
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10"
                      role="progressbar"
                      aria-label={`${EGG_TIER_LABEL[egg.tier]}孵化进度`}
                      aria-valuemin={0}
                      aria-valuemax={EGG_HATCH_DAYS}
                      aria-valuenow={progress}
                    >
                      <div
                        className="h-full rounded-full bg-leaf transition-[width] duration-300 ease-out"
                        style={{ width: `${(progress / EGG_HATCH_DAYS) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-ink/40">
                      {demo
                        ? '演示蛋可以直接快进孵化，结果不会写入正式图鉴。'
                        : progress === 0
                          ? '每天记一笔，蛋壳裂一点；记满 3 天出精灵。'
                          : `已经裂了 ${progress} 下，再记 ${EGG_HATCH_DAYS - progress} 天。`}
                    </p>
                  </div>
                </div>
                {demo && onDemoHatch && (
                  <button
                    type="button"
                    onClick={() => handleDemoHatch(egg.id)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-xs font-medium text-ink/60 transition-colors hover:bg-white hover:text-ink"
                  >
                    演示孵化
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
