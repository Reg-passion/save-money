import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react'
import { RARITY_LABEL, SPIRIT_BY_ID } from '../data/catalog'
import {
  EGG_TIER_LABEL,
  WEEKLY_HATCH_EVENT,
  formatPercent,
  getEggWeekSummary,
  hatchWeeklyEgg,
  loadDemoWeeklyEgg,
  nextEggTierForScore,
  runDemoWeeklyHatch,
  syncEggState,
  type DemoEggState,
  type EggRecord,
  type EggWeekSummary,
  type HatchResult,
  type WeeklyHatchOutcome,
} from '../lib/egg'
import { formatCents } from '../lib/money'
import { loadState, saveState } from '../lib/storage'
import type { EggTier, IslandState } from '../types'
import { SpiritSprite } from './Codex'

const TIER_CHIP: Record<EggTier, string> = {
  normal: 'bg-[#F4EAD7] text-[#8A6A3C]',
  silver: 'bg-[#E8EFF2] text-[#566E78]',
  gold: 'bg-[#FBEDC0] text-[#8E6415]',
}

const SHELL_COLORS: Record<
  EggTier,
  { shell: string; stroke: string; spot: string; shine: string }
> = {
  normal: { shell: '#FFF8E7', stroke: '#D9C59A', spot: '#E7D2A8', shine: '#FFFDF7' },
  silver: { shell: '#EDF3F5', stroke: '#A8BCC4', spot: '#C9D8DD', shine: '#FFFFFF' },
  gold: { shell: '#FFF1C2', stroke: '#D4A63E', spot: '#E8C46A', shine: '#FFF9DF' },
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const EGG_STYLES = `
.egg-dialog::backdrop {
  background-color: rgb(24 45 51 / 0.52);
  backdrop-filter: blur(5px);
  overflow: hidden;
  overscroll-behavior: contain;
}
.egg-dialog:modal {
  overscroll-behavior: contain;
}
.egg-dialog [data-egg-cracks] {
  transform-box: fill-box;
  transform-origin: center;
}
@media (prefers-reduced-motion: no-preference) {
  .egg-shell-float {
    animation: egg-float 5s ease-in-out infinite;
  }
  .egg-shell-glow {
    animation: egg-glow 1s ease-out both;
  }
  .egg-crack-mark {
    animation: egg-crack-pop 0.28s ease-out;
  }
  .egg-reveal-pop {
    animation: egg-reveal-pop 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
  }
  .egg-score-float {
    animation: egg-score-float 0.9s ease-out both;
  }
}
@keyframes egg-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes egg-glow {
  0% { transform: scale(0.94); filter: brightness(1); }
  45% { transform: scale(1.04); filter: brightness(1.12); }
  100% { transform: scale(1); filter: brightness(1); }
}
@keyframes egg-crack-pop {
  0% { opacity: 0; transform: scale(0.85); }
  60% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes egg-reveal-pop {
  0% { opacity: 0; transform: scale(0.6) translateY(12px); }
  70% { opacity: 1; transform: scale(1.06) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes egg-score-float {
  0% { opacity: 0; transform: translateY(8px); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-22px); }
}
`

function shellCracksForWeek(days: EggWeekSummary['days']): number {
  const scored = days.filter((day) => day.score > 0).length
  if (scored <= 0) return 0
  if (scored <= 2) return 1
  if (scored <= 5) return 2
  return 3
}

function formatWeekRange(week: EggWeekSummary): string {
  const format = (date: string) => {
    const value = new Date(`${date}T00:00:00`)
    if (Number.isNaN(value.getTime())) return date
    return value.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  }
  return `${format(week.weekStart)} – ${format(week.weekEnd)}`
}

function weekdayOf(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return ''
  return `周${WEEKDAY_LABELS[(value.getDay() + 6) % 7]}`
}

function EggShell({
  tier,
  cracks,
  glow = false,
  animate = true,
}: {
  tier: EggTier
  cracks: number
  glow?: boolean
  animate?: boolean
}) {
  const colors = SHELL_COLORS[tier]

  return (
    <div className={`relative ${glow ? 'egg-shell-glow' : ''}`}>
      {glow && (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 top-4 bottom-4 rounded-full bg-[#F5D77D]/45 blur-2xl"
        />
      )}
      <svg
        viewBox="0 0 120 150"
        className={`relative h-auto w-full ${animate ? 'egg-shell-float' : ''}`}
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
        <g data-egg-cracks>
          {cracks >= 1 && (
            <g key={`crack-1-${cracks}`} className="egg-crack-mark">
              <path
                d="m61 46 7 7-5 8 7 6"
                fill="none"
                stroke="#7A5C3C"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
              />
            </g>
          )}
          {cracks >= 2 && (
            <g key={`crack-2-${cracks}`} className="egg-crack-mark">
              <path
                d="m82 81-8 5 5 8-10 5m-12 7 5 7-4 7"
                fill="none"
                stroke="#7A5C3C"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
              />
            </g>
          )}
          {cracks >= 3 && (
            <g key={`crack-3-${cracks}`} className="egg-crack-mark">
              <path
                d="m38 69 8 5-5 7 7 6"
                fill="none"
                stroke="#7A5C3C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}

interface HatchFlow {
  preview: WeeklyHatchOutcome
  phase: 'upgrade' | 'crack' | 'reveal'
  cracks: number
  saveError: boolean
}

interface EggProps {
  // 兼容旧版月度结算组件；v2 蛋面板自己从 localStorage 读状态。
  eggs?: EggRecord[]
  variant?: 'formal' | 'demo'
  onDemoHatch?: (eggId: string) => HatchResult | null
}

export default function Egg(_props: EggProps = {}) {
  const [state, setState] = useState<IslandState>(() => loadState())
  const [week, setWeek] = useState<EggWeekSummary>(() => getEggWeekSummary(loadState()))
  const [demo, setDemo] = useState<DemoEggState>(() => loadDemoWeeklyEgg())
  const [flow, setFlow] = useState<HatchFlow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const titleId = useId()
  const hatchTitleId = useId()
  const hatchDescId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const committedRef = useRef(false)
  const signatureRef = useRef('')
  const flowRef = useRef<HatchFlow | null>(null)

  const displayScore = week.hatched ? state.egg.score : week.score
  const displayTier = week.hatched ? (state.egg.tier ?? week.tier) : week.tier
  const nextInfo = nextEggTierForScore(displayScore)
  const enteredDays = week.days.filter((day) => !day.future && day.score >= 10).length
  const cracks = week.hatched ? 3 : shellCracksForWeek(week.days)
  const hatchedSpirit = week.hatchedSpiritId ? SPIRIT_BY_ID[week.hatchedSpiritId] : null
  const demoSpirit = demo.last ? SPIRIT_BY_ID[demo.last.spiritId] : null
  const scorePercent = Math.min(100, Math.round((displayScore / 115) * 100))

  useEffect(() => {
    flowRef.current = flow
  }, [flow])

  useEffect(() => {
    try {
      const next = syncEggState()
      signatureRef.current = JSON.stringify(next)
      // oxlint-disable-next-line react/set-state-in-effect -- localStorage 是外部系统，打开面板时把结算结果同步进来
      setState(next)
      // oxlint-disable-next-line react/set-state-in-effect -- 同上
      setWeek(getEggWeekSummary(next))
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : '读取蛋的状态失败，请刷新重试。',
      )
    }
  }, [])

  useEffect(() => {
    const refresh = () => {
      if (flowRef.current || document.visibilityState === 'hidden') return
      const latest = loadState()
      const signature = JSON.stringify(latest)
      if (signature === signatureRef.current) return
      signatureRef.current = signature
      setState(latest)
      setWeek(getEggWeekSummary(latest))
    }
    const timer = window.setInterval(refresh, 2500)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const commitHatch = useCallback((preview: WeeklyHatchOutcome) => {
    if (committedRef.current) return
    committedRef.current = true
    try {
      saveState(preview.state)
      signatureRef.current = JSON.stringify(preview.state)
      setState(preview.state)
      setWeek(getEggWeekSummary(preview.state))
      setError(null)
      setFlow((current) =>
        current ? { ...current, phase: 'reveal', cracks: 3, saveError: false } : current,
      )
    } catch (nextError) {
      committedRef.current = false
      setFlow((current) =>
        current
          ? {
              ...current,
              phase: 'reveal',
              cracks: 3,
              saveError: true,
            }
          : current,
      )
      setError(
        nextError instanceof Error
          ? `孵化结果保存失败：${nextError.message}`
          : '孵化结果保存失败，请检查浏览器存储空间。',
      )
    }
  }, [])

  useEffect(() => {
    const onWeeklyReport = (event: Event) => {
      const detail = (event as CustomEvent<{ weekStart?: string }>).detail
      if (flowRef.current) return
      let preview: WeeklyHatchOutcome
      try {
        preview = hatchWeeklyEgg(loadState(), detail?.weekStart ?? new Date())
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '孵化失败，请稍后重试。')
        return
      }
      if (preview.alreadyHatched) {
        setNotice(`本周的蛋已经孵出 ${preview.spirit.name}，图鉴不会重复添加。`)
        return
      }
      committedRef.current = false
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduceMotion) {
        setFlow({ preview, phase: 'reveal', cracks: 3, saveError: false })
        commitHatch(preview)
        return
      }
      setFlow({ preview, phase: 'upgrade', cracks: 0, saveError: false })
    }
    window.addEventListener(WEEKLY_HATCH_EVENT, onWeeklyReport)
    return () => window.removeEventListener(WEEKLY_HATCH_EVENT, onWeeklyReport)
  }, [commitHatch])

  useEffect(() => {
    if (!flow || flow.phase === 'reveal') return
    const delay = flow.phase === 'upgrade' ? 1000 : flow.cracks >= 3 ? 420 : 320
    const timer = window.setTimeout(() => {
      if (flow.phase === 'upgrade') {
        setFlow((current) =>
          current ? { ...current, phase: 'crack', cracks: 1 } : current,
        )
      } else if (flow.cracks < 3) {
        setFlow((current) => (current ? { ...current, cracks: current.cracks + 1 } : current))
      } else {
        commitHatch(flow.preview)
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [flow, commitHatch])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (flow && !dialog.open) dialog.showModal()
    if (!flow && dialog.open) dialog.close()
  }, [flow])

  useEffect(() => {
    if (flow?.phase !== 'reveal') return
    closeButtonRef.current?.focus()
  }, [flow?.phase])

  function skipAnimation() {
    const preview = flowRef.current?.preview
    if (preview) commitHatch(preview)
  }

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    if (flowRef.current?.phase === 'reveal') {
      dialogRef.current?.close()
      return
    }
    skipAnimation()
  }

  function handleDialogClose() {
    const current = flowRef.current
    if (current && current.phase !== 'reveal') commitHatch(current.preview)
    committedRef.current = false
    setFlow(null)
  }

  function handleDemoHatch() {
    setError(null)
    try {
      const outcome = runDemoWeeklyHatch(loadState())
      setDemo(outcome.demo)
      setNotice('演示孵化完成，结果只保存在演示记录里。')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '演示孵化失败，请稍后重试。')
    }
  }

  const dialogScoreDelta = flow ? Math.max(0, flow.preview.score - flow.preview.fromScore) : 0

  return (
    <section
      className="glass-panel pointer-events-auto p-4"
      aria-labelledby={titleId}
      data-egg-variant="v2"
    >
      <style>{EGG_STYLES}</style>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-leaf">EGG NEST</p>
          <h2 id={titleId} className="mt-1 text-base font-bold text-ink">
            本周蛋
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
            {formatWeekRange(week)} · 7 天孵一只精灵
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIER_CHIP[displayTier]}`}
        >
          {EGG_TIER_LABEL[displayTier]}
        </span>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-2xl bg-[#FBE3DD] px-3 py-2 text-[11px] leading-relaxed text-[#8F3F2E]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-2xl bg-[#EDF6E5] px-3 py-2 text-[11px] leading-relaxed text-[#4F7B39]"
        >
          {notice}
        </p>
      )}

      <div className="mt-3 flex items-center gap-4">
        <div className="w-[104px] shrink-0">
          {week.hatched && hatchedSpirit ? (
            <div className="relative">
              <SpiritSprite spirit={hatchedSpirit} className="h-auto w-full" />
              <span className="absolute -right-1 -top-1 rounded-full bg-[#FBEDC0] px-1.5 py-0.5 text-[9px] font-semibold text-[#8E6415]">
                已孵化
              </span>
            </div>
          ) : (
            <EggShell tier={displayTier} cracks={cracks} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] text-ink/45">蛋品质分</p>
            <p className="text-xl font-bold leading-none text-ink">
              {displayScore}
              <span className="text-[11px] font-medium text-ink/40"> / 115</span>
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="蛋品质分"
            aria-valuemin={0}
            aria-valuemax={115}
            aria-valuenow={displayScore}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/60"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6dbb79] to-[#f0c85a] transition-[width] duration-500"
              style={{ width: `${scorePercent}%` }}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-xl border border-white/55 bg-white/35 px-2 py-1.5">
              <p className="text-ink/40">本周花了</p>
              <p className="mt-0.5 font-semibold text-ink">
                {formatCents(week.spentCents)} / {formatCents(state.budgets.weekly)} 元
              </p>
            </div>
            <div className="rounded-xl border border-white/55 bg-white/35 px-2 py-1.5">
              <p className="text-ink/40">稀有概率</p>
              <p className="mt-0.5 font-semibold text-ink">{formatPercent(week.rareChance)}</p>
            </div>
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-ink/45">
            {displayTier !== week.startingTier
              ? `${EGG_TIER_LABEL[week.startingTier]} → ${EGG_TIER_LABEL[displayTier]} · `
              : ''}
            {week.hatched
              ? `最终 ${displayScore} 分，本周精灵已进图鉴。`
              : nextInfo.tier
                ? `再 +${nextInfo.points} 分升到${EGG_TIER_LABEL[nextInfo.tier]}。`
                : '已经是最高档金蛋。'}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/55 bg-white/35 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className="text-ink/45">{week.hatched ? '本周记录' : '每天加分'}</span>
          <span className="text-ink/40">
            守住 {enteredDays} / 7 天 · 已结算 {week.settledDays} 天
          </span>
        </div>
        <ol className="mt-2 grid grid-cols-7 gap-1" aria-label="本周每天蛋加分">
          {week.days.map((day) => (
            <li key={day.date} className="flex min-w-0 flex-col items-center gap-0.5">
              <span
                className={`flex h-7 w-full items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums ${
                  day.future
                    ? 'bg-ink/5 text-ink/25'
                    : day.score >= 15
                      ? 'bg-[#E4F1DA] text-[#3F6B35]'
                      : day.score >= 10
                        ? 'bg-[#EDF3E4] text-[#5C7A4A]'
                        : 'bg-[#F4EDE4] text-[#967A62]'
                }`}
                title={`${weekdayOf(day.date)} ${day.score > 0 ? `+${day.score} 分` : '0 分'}${
                  day.future ? '，还没到' : ''
                }`}
              >
                {day.future ? '·' : day.score > 0 ? `+${day.score}` : '0'}
              </span>
              <span className="text-[8px] text-ink/35">{weekdayOf(day.date).slice(1)}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink/40">
        每天第一次打开时结算昨天：≤日预算 80% 加 15 分，≤日预算加 10 分，超支不加分也不扣分。
        生成周总结后先看报告，再孵蛋。
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!week.hatched && (
          <a
            href="#reports"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-leaf px-3 text-xs font-semibold text-white transition-colors hover:bg-[#549A5F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            去生成周总结
          </a>
        )}
        <button
          type="button"
          onClick={handleDemoHatch}
          className="min-h-11 rounded-xl border border-ink/15 bg-white/70 px-3 text-xs font-semibold text-ink/60 transition-colors hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          演示孵化
        </button>
        <span className="text-[9px] text-ink/30">演示不会写入正式图鉴</span>
      </div>

      {demo.last && demoSpirit && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#E9DCC7] bg-[#FBF6E8] p-3">
          <SpiritSprite spirit={demoSpirit} className="h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">
              演示结果 · {demoSpirit.name}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-ink/50">
              {EGG_TIER_LABEL[demo.last.tier]} · 稀有判定 {formatPercent(demo.last.rareChance)} ·{' '}
              {demo.last.isNew ? '正式图鉴里还没有它' : '正式图鉴里已经有它'}
            </p>
            <p className="mt-0.5 text-[10px] text-[#8A6A3C]">只保存在演示记录，不写正式图鉴。</p>
          </div>
          <span className="shrink-0 text-[10px] text-ink/30">第 {demo.runs} 次</span>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={hatchTitleId}
        aria-describedby={hatchDescId}
        onCancel={handleDialogCancel}
        onClose={handleDialogClose}
        className="egg-dialog m-auto w-[min(23rem,calc(100vw-2rem))] rounded-[28px] border border-white/70 bg-[#FFFCF3] p-0 text-ink shadow-2xl"
        {...({ closedby: 'none' } as Record<string, string>)}
      >
        {flow && (
          <div className="flex max-h-[88vh] flex-col items-center overflow-y-auto px-5 py-6 text-center">
            <p className="text-[10px] font-semibold tracking-[0.3em] text-leaf">
              WEEKLY HATCH
            </p>
            <h2 id={hatchTitleId} className="mt-1 text-lg font-bold text-ink">
              {flow.phase === 'reveal'
                ? `孵出 ${flow.preview.spirit.name}`
                : flow.phase === 'crack'
                  ? `蛋壳裂了 ${flow.cracks} 下`
                  : '蛋品质升级中'}
            </h2>
            <p id={hatchDescId} className="mt-1 text-[11px] leading-relaxed text-ink/50">
              {flow.phase === 'reveal'
                ? `${RARITY_LABEL[flow.preview.spirit.rarity]}精灵 · 总分 ${flow.preview.score} 分 · ${EGG_TIER_LABEL[flow.preview.tier]} · 稀有判定 ${formatPercent(flow.preview.rareChance)}`
                : flow.phase === 'crack'
                  ? '再裂一下，精灵就要出来了。'
                  : `${EGG_TIER_LABEL[flow.preview.fromTier]} → ${EGG_TIER_LABEL[flow.preview.tier]} · 总分 ${flow.preview.score} 分 · 稀有概率 ${formatPercent(flow.preview.rareChance)}`}
            </p>

            <div className="relative mt-4 flex h-48 w-40 items-center justify-center">
              {flow.phase === 'reveal' ? (
                <div className="egg-reveal-pop">
                  <SpiritSprite spirit={flow.preview.spirit} className="h-40 w-40" />
                </div>
              ) : (
                <>
                  <div className="w-36">
                    <EggShell
                      tier={flow.preview.tier}
                      cracks={flow.cracks}
                      glow={flow.phase === 'upgrade'}
                    />
                  </div>
                  {dialogScoreDelta > 0 && (
                    <span className="egg-score-float absolute right-0 top-4 rounded-full bg-[#E4F1DA] px-2.5 py-1 text-sm font-bold text-[#3F6B35]">
                      +{dialogScoreDelta} 分
                    </span>
                  )}
                </>
              )}
            </div>

            {flow.phase === 'reveal' && (
              <div className="mt-3 w-full rounded-2xl border border-white/70 bg-white/55 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-ink/60">
                  {flow.saveError
                    ? '孵化结果没能保存，刷新后可能丢失，请检查浏览器存储空间。'
                    : flow.preview.isNew
                      ? '已加入正式图鉴。'
                      : '图鉴里已经有它，获得次数 +1。'}
                </p>
              </div>
            )}

            {flow.saveError && (
              <p role="alert" className="sr-only">
                孵化结果保存失败
              </p>
            )}

            <div className="mt-5 w-full">
              {flow.phase === 'reveal' ? (
                <form method="dialog">
                  <button
                    ref={closeButtonRef}
                    className="min-h-11 w-full rounded-2xl bg-ink px-4 text-sm font-semibold text-cream transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                  >
                    {flow.saveError ? '关闭' : '收下精灵'}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={skipAnimation}
                  className="min-h-11 w-full rounded-2xl border border-ink/15 bg-white/70 px-4 text-xs font-semibold text-ink/60 transition-colors hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                >
                  跳过动画
                </button>
              )}
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}