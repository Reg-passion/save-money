import { useId, useState } from 'react'
import { EGG_SCORE_MAX, toDateKey } from '../lib/budget'
import { CATEGORIES } from '../data/categories'
import { formatBillTime } from '../lib/island'
import { formatCents } from '../lib/money'
import {
  buildDailyReport,
  loadStoredReports,
  saveDailyReport,
  type DailyReport as DailyReportData,
  type SavedReport,
} from '../lib/report'
import { loadState } from '../lib/storage'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))
const TIER_LABELS = {
  normal: '普通蛋',
  silver: '银蛋',
  gold: '金蛋',
} as const

function formatDay(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return date
  return value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function formatGeneratedAt(iso: string): string {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return ''
  return value.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function DailyReport() {
  const [stored, setStored] = useState<SavedReport<DailyReportData> | null>(
    () => loadStoredReports().daily,
  )
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const titleId = useId()

  function handleGenerate() {
    try {
      const report = buildDailyReport(loadState(), toDateKey(new Date()))
      try {
        setStored(saveDailyReport(report))
        setFeedback({ kind: 'ok', text: '已生成今天的总结，再点一次会更新同一份。' })
      } catch {
        setStored({ generatedAt: new Date().toISOString(), report })
        setFeedback({
          kind: 'error',
          text: '报告已生成，但本地保存失败，刷新后可能丢失。',
        })
      }
    } catch (error) {
      setFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '生成日报失败',
      })
    }
  }

  const report = stored?.report

  return (
    <section
      id="daily-report"
      aria-labelledby={titleId}
      className="glass-panel pointer-events-auto p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.28em] text-ink/30">DAILY REPORT</p>
          <h2 id={titleId} className="mt-0.5 text-base font-bold text-ink">
            今日总结
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
            点按钮才生成；同一天只保留最新一份。
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          className="min-h-11 rounded-full bg-leaf px-4 text-xs font-semibold text-white shadow-[0_12px_24px_-14px_rgba(38,91,54,0.8)] transition-colors hover:bg-[#549A5F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          生成今日总结
        </button>
      </header>

      {feedback && (
        <p
          role={feedback.kind === 'ok' ? 'status' : 'alert'}
          className={`mt-3 rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
            feedback.kind === 'ok'
              ? 'bg-[#EDF6E5] text-[#4F7B39]'
              : 'bg-[#FBE3DD] text-[#8F3F2E]'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {!report ? (
        <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/35 px-4 py-8 text-center text-xs leading-relaxed text-ink/40">
          还没有日报。今天随时可以点“生成今日总结”，不会自动弹窗。
        </p>
      ) : (
        <article aria-label={`${formatDay(report.date)} 日报`} className="mt-4 flex flex-col gap-3">
          <div className="rounded-2xl border border-white/70 bg-white/55 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium text-ink/45">今天花了</p>
                <p className="mt-0.5 text-2xl font-bold leading-none text-ink">
                  {formatCents(report.spentCents)}
                  <span className="ml-1 text-xs font-medium text-ink/40">
                    {' / '}
                    {formatCents(report.budgetCents)} 元
                  </span>
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  report.remainingCents >= 0
                    ? 'bg-[#E4F1DA] text-[#4F7B39]'
                    : 'bg-[#FBE3DD] text-[#A34A38]'
                }`}
              >
                {report.remainingCents >= 0
                  ? `还剩 ${formatCents(report.remainingCents)} 元`
                  : `超了 ${formatCents(-report.remainingCents)} 元`}
              </span>
            </div>
            <progress
              max={report.budgetCents}
              value={report.spentCents}
              aria-label="今日预算使用进度"
              className="mt-3 w-full accent-[#5C8C5A]"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink/45">
              <span>
                今天省了 <b className="text-[#4F7B39]">{formatCents(report.savedCents)} 元</b>
              </span>
              <span>{formatDay(report.date)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/45 p-3.5">
            <h3 className="text-[11px] font-bold text-ink">分类 Top 3</h3>
            {report.topCategories.length === 0 ? (
              <p className="mt-2 text-[11px] text-ink/40">今天还没有支出。</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2.5">
                {report.topCategories.map((category) => (
                  <li key={category.category}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-medium text-ink">
                        {CATEGORY_NAMES.get(category.category) ?? '其他'}
                      </span>
                      <span className="text-ink/50">
                        {formatCents(category.amountCents)} 元 · {category.pct}%
                      </span>
                    </div>
                    <progress
                      max={100}
                      value={category.pct}
                      aria-label={`${CATEGORY_NAMES.get(category.category) ?? '其他'} 占今天支出的 ${category.pct}%`}
                      className="mt-1 w-full accent-[#7FA76D]"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/45 p-3.5">
            <h3 className="text-[11px] font-bold text-ink">今天最贵的一笔</h3>
            {report.biggest ? (
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/75 text-xs font-semibold text-ink/55">
                  {(CATEGORY_NAMES.get(report.biggest.category) ?? '账').slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">
                    {CATEGORY_NAMES.get(report.biggest.category) ?? '其他'}
                    {report.biggest.note ? ` · ${report.biggest.note}` : ''}
                  </p>
                  <p className="text-[10px] text-ink/40">{formatBillTime(report.biggest.time)}</p>
                </div>
                <b className="shrink-0 text-sm text-[#A94F37]">
                  -{formatCents(report.biggest.amountCents)} 元
                </b>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-ink/40">今天还没有支出。</p>
            )}
          </div>

          <div className="rounded-2xl border border-[#D8E5C8] bg-[#F3F8EB] p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-bold text-[#3F6B35]">蛋</h3>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#4F7B39]">
                +{report.eggAdded} 分
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink/60">
              当前蛋总分 {report.eggTotal} / {EGG_SCORE_MAX} 分 · {TIER_LABELS[report.eggTier]}
              {report.nextTier
                ? ` · 离${TIER_LABELS[report.nextTier]}还差 ${report.pointsToNextTier} 分`
                : ' · 已经到金蛋档'}
            </p>
            <progress
              max={EGG_SCORE_MAX}
              value={report.eggTotal}
              aria-label={`当前蛋总分 ${report.eggTotal} 分`}
              className="mt-2 w-full accent-[#7FA76D]"
            />
          </div>

          <p className="rounded-2xl border border-[#E9DCC7] bg-[#FBF6E8] px-3.5 py-3 text-[11px] leading-relaxed text-[#765624]">
            <span className="font-semibold">今天一条建议：</span>
            {report.tip}
          </p>

          <p className="text-right text-[9px] text-ink/30">
            生成于 {formatGeneratedAt(stored.generatedAt)}
          </p>
        </article>
      )}
    </section>
  )
}