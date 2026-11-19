import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { CATEGORIES } from '../data/categories'
import { EGG_SCORE_MAX } from '../lib/budget'
import { notifyWeeklyReportGenerated } from '../lib/egg'
import { formatBillTime } from '../lib/island'
import { formatCents } from '../lib/money'
import {
  buildTransactionsCsv,
  buildWeeklyReport,
  buildWeeklyShareText,
  createReportBackup,
  loadStoredReports,
  parseReportBackup,
  reportBackupFilename,
  restoreReportBackup,
  saveWeeklyReport,
  transactionsCsvFilename,
  type ParsedReportBackup,
  type SavedReport,
  type WeeklyReport as WeeklyReportData,
} from '../lib/report'
import { loadState } from '../lib/storage'

const CATEGORY_NAMES = new Map(CATEGORIES.map((category) => [category.id, category.name]))
const TIER_LABELS = {
  normal: '普通蛋',
  silver: '银蛋',
  gold: '金蛋',
} as const
const WEEKDAY_LABELS = '日一二三四五六'

function formatWeekday(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return ''
  return WEEKDAY_LABELS[value.getDay()] ?? ''
}

function formatDay(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return date
  return value.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function formatFullDay(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return date
  return value.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
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

function fallbackCopy(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '-9999px'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) throw new Error('复制失败')
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function WeeklyReport() {
  const [stored, setStored] = useState<SavedReport<WeeklyReportData> | null>(
    () => loadStoredReports().weekly,
  )
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const [dataFeedback, setDataFeedback] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const [parsed, setParsed] = useState<ParsedReportBackup | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const copyTimerRef = useRef<number | null>(null)
  const titleId = useId()
  const dataTitleId = useId()

  useEffect(
    () => () => {
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current)
    },
    [],
  )

  function announceCopy(ok: boolean) {
    if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current)
    setCopyFeedback(
      ok
        ? { kind: 'ok', text: '已复制周报文案' }
        : { kind: 'error', text: '复制失败，请重试或手动选择文案' },
    )
    copyTimerRef.current = window.setTimeout(() => setCopyFeedback(null), 3000)
  }

  async function handleCopy() {
    if (!stored) return
    const text = buildWeeklyShareText(stored.report)
    try {
      await navigator.clipboard.writeText(text)
      announceCopy(true)
    } catch {
      try {
        fallbackCopy(text)
        announceCopy(true)
      } catch {
        announceCopy(false)
      }
    }
  }

  function handleGenerate() {
    try {
      const report = buildWeeklyReport(loadState(), new Date())
      try {
        const saved = saveWeeklyReport(report)
        setStored(saved)
        setFeedback({
          kind: 'ok',
          text: '已生成本周总结，看完报告后蛋会自动开始孵化。',
        })
        notifyWeeklyReportGenerated(saved.report.weekStart)
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
        text: error instanceof Error ? error.message : '生成周报失败',
      })
    }
  }

  function handleCsvExport() {
    try {
      downloadText(
        transactionsCsvFilename(),
        buildTransactionsCsv(loadState()),
        'text/csv;charset=utf-8',
      )
      setDataFeedback({ kind: 'ok', text: '已导出账单 CSV。' })
    } catch (error) {
      setDataFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '导出 CSV 失败',
      })
    }
  }

  function handleJsonExport() {
    try {
      downloadText(
        reportBackupFilename(),
        createReportBackup(),
        'application/json;charset=utf-8',
      )
      setDataFeedback({ kind: 'ok', text: '已导出 v2 JSON 备份。' })
    } catch (error) {
      setDataFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '导出 JSON 失败',
      })
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setParsed(null)
    setFileName(file.name)
    setDataFeedback(null)

    if (file.size > 2 * 1024 * 1024) {
      setDataFeedback({ kind: 'error', text: '备份文件超过 2 MB，不像是钱钱岛导出的数据。' })
      return
    }

    try {
      const text = await file.text()
      setParsed(parseReportBackup(text))
      setDataFeedback({ kind: 'ok', text: '文件读取成功，确认后才会替换当前数据。' })
    } catch (error) {
      setDataFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '读取备份失败',
      })
    }
  }

  function handleRestore() {
    if (!parsed) return
    setRestoring(true)
    setDataFeedback(null)
    try {
      restoreReportBackup(parsed)
      setDataFeedback({ kind: 'ok', text: '恢复成功，正在重新载入…' })
      window.setTimeout(() => window.location.reload(), 300)
    } catch (error) {
      setRestoring(false)
      setDataFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '恢复备份失败',
      })
    }
  }

  const report = stored?.report

  return (
    <section
      id="weekly-report"
      aria-labelledby={titleId}
      className="glass-panel pointer-events-auto p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.28em] text-ink/30">WEEKLY REPORT</p>
          <h2 id={titleId} className="mt-0.5 text-base font-bold text-ink">
            本周总结
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
            点按钮才生成；同一周只保留最新一份。
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          className="min-h-11 rounded-full bg-leaf px-4 text-xs font-semibold text-white shadow-[0_12px_24px_-14px_rgba(38,91,54,0.8)] transition-colors hover:bg-[#549A5F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          生成周总结
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
          还没有周报。周日晚上或周一随时可以点“生成周总结”，不会自动弹窗。
        </p>
      ) : (
        <article
          aria-label={`${report.weekStart} 至 ${report.weekEnd} 周报`}
          className="mt-4 flex flex-col gap-3"
        >
          <div className="rounded-2xl border border-white/70 bg-white/55 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium text-ink/45">本周花了</p>
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
              aria-label="本周预算使用进度"
              className="mt-3 w-full accent-[#5C8C5A]"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink/45">
              <span>
                本周省了 <b className="text-[#4F7B39]">{formatCents(report.savedCents)} 元</b>
              </span>
              <span>
                {formatDay(report.weekStart)} – {formatDay(report.weekEnd)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/45 p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-bold text-ink">每天花了多少</h3>
              <span className="text-[9px] text-ink/35">7 天</span>
            </div>
            <ol className="mt-3 grid grid-cols-7 items-end gap-1.5" aria-label="本周每天支出">
              {report.dailyBars.map((bar) => (
                <li key={bar.date} className="flex min-w-0 flex-col items-center gap-1">
                  <span aria-hidden="true" className="text-[8px] font-medium text-ink/55">
                    {formatCents(bar.spentCents)}
                  </span>
                  <div
                    aria-hidden="true"
                    className="flex h-20 w-full items-end overflow-hidden rounded-lg bg-ink/5"
                  >
                    <div
                      className={`w-full rounded-lg ${
                        bar.overBudget ? 'bg-[#C46A53]' : 'bg-leaf'
                      }`}
                      style={{
                        height:
                          bar.spentCents > 0 ? `${Math.max(6, bar.pctOfBudget)}%` : '0%',
                      }}
                    />
                  </div>
                  <span aria-hidden="true" className="text-[9px] text-ink/45">
                    {formatWeekday(bar.date)}
                  </span>
                  <span className="sr-only">
                    {formatFullDay(bar.date)} 花费 {formatCents(bar.spentCents)} 元
                    {bar.overBudget ? '，超出日预算' : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/45 p-3.5">
            <h3 className="text-[11px] font-bold text-ink">分类占比</h3>
            {report.topCategories.length === 0 ? (
              <p className="mt-2 text-[11px] text-ink/40">本周还没有支出。</p>
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
                      aria-label={`${CATEGORY_NAMES.get(category.category) ?? '其他'} 占本周支出的 ${category.pct}%`}
                      className="mt-1 w-full accent-[#7FA76D]"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/45 p-3">
              <p className="text-[9px] text-ink/40">守住预算</p>
              <p className="mt-1 text-lg font-bold leading-none text-ink">
                {report.goodDays}
                <span className="text-xs font-medium text-ink/40"> / 7 天</span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/45 p-3">
              <p className="text-[9px] text-ink/40">本周省了</p>
              <p className="mt-1 text-lg font-bold leading-none text-ink">
                {formatCents(report.savedCents)}
                <span className="text-xs font-medium text-ink/40"> 元</span>
              </p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/70 bg-white/45 p-3">
              <p className="text-[9px] text-ink/40">最贵的一笔</p>
              {report.biggest ? (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {CATEGORY_NAMES.get(report.biggest.category) ?? '其他'}
                      {report.biggest.note ? ` · ${report.biggest.note}` : ''}
                    </p>
                    <p className="text-[10px] text-ink/40">
                      {formatBillTime(report.biggest.time)}
                    </p>
                  </div>
                  <b className="shrink-0 text-sm text-[#A94F37]">
                    -{formatCents(report.biggest.amountCents)} 元
                  </b>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-ink/40">本周还没有支出。</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#D8E5C8] bg-[#F3F8EB] p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-bold text-[#3F6B35]">本周蛋</h3>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#4F7B39]">
                {report.score} 分 · {TIER_LABELS[report.tier]}
              </span>
            </div>
            <progress
              max={EGG_SCORE_MAX}
              value={report.score}
              aria-label={`本周蛋总分 ${report.score} 分`}
              className="mt-2 w-full accent-[#7FA76D]"
            />
          </div>

          <p className="rounded-2xl border border-[#E9DCC7] bg-[#FBF6E8] px-3.5 py-3 text-[11px] leading-relaxed text-[#765624]">
            <span className="font-semibold">下周一条建议：</span>
            {report.tip}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-11 rounded-xl border border-[#D8E5C8] bg-white/75 px-3 text-xs font-semibold text-[#4F7B39] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
            >
              复制周报文案
            </button>
            {copyFeedback && (
              <span
                role={copyFeedback.kind === 'ok' ? 'status' : 'alert'}
                className={`text-[10px] ${
                  copyFeedback.kind === 'ok' ? 'text-[#4F7B39]' : 'text-[#8F3F2E]'
                }`}
              >
                {copyFeedback.text}
              </span>
            )}
            <span className="ml-auto text-[9px] text-ink/30">
              生成于 {formatGeneratedAt(stored.generatedAt)}
            </span>
          </div>
        </article>
      )}

      <section
        aria-labelledby={dataTitleId}
        className="mt-4 border-t border-ink/10 pt-4"
      >
        <p className="text-[9px] font-semibold tracking-[0.28em] text-ink/30">DATA</p>
        <h3 id={dataTitleId} className="mt-0.5 text-sm font-bold text-ink">
          导出与恢复
        </h3>
        <p className="mt-1 text-[10px] leading-relaxed text-ink/45">
          CSV 只导出 v2 账单；JSON 含 v2 账本、许愿池和已生成报告。恢复会替换 v2
          数据，不会动旧版首页账本。
        </p>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleCsvExport}
            className="min-h-11 rounded-xl border border-ink/10 bg-white/70 px-3 text-[11px] font-semibold text-ink/65 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            导出账单 CSV
          </button>
          <button
            type="button"
            onClick={handleJsonExport}
            className="min-h-11 rounded-xl border border-ink/10 bg-white/70 px-3 text-[11px] font-semibold text-ink/65 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            导出 JSON 备份
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-11 rounded-xl border border-ink/10 bg-white/70 px-3 text-[11px] font-semibold text-ink/65 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            选择 JSON 恢复
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="选择钱钱岛 v2 JSON 备份文件"
        />

        {dataFeedback && (
          <p
            role={dataFeedback.kind === 'ok' ? 'status' : 'alert'}
            className={`mt-3 rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
              dataFeedback.kind === 'ok'
                ? 'bg-[#EDF6E5] text-[#4F7B39]'
                : 'bg-[#FBE3DD] text-[#8F3F2E]'
            }`}
          >
            {dataFeedback.text}
          </p>
        )}

        {parsed && (
          <section
            aria-label="备份预览"
            className="mt-3 rounded-2xl border border-[#D9CBA9] bg-[#FBF6E8] p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-xs font-bold text-ink">恢复前预览</h4>
              <span className="max-w-[14rem] truncate text-[10px] text-ink/40">{fileName}</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] leading-relaxed">
              <div className="flex justify-between gap-2">
                <dt className="text-ink/45">导出时间</dt>
                <dd className="text-right font-medium text-ink">
                  {formatGeneratedAt(parsed.preview.exportedAt) || '未知'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink/45">账单</dt>
                <dd className="font-medium text-ink">{parsed.preview.transactionCount} 笔</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink/45">许愿池</dt>
                <dd className="font-medium text-ink">{parsed.preview.wishCount} 个</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink/45">预算</dt>
                <dd className="font-medium text-ink">
                  {formatCents(parsed.preview.dailyBudgetCents)} /{' '}
                  {formatCents(parsed.preview.weeklyBudgetCents)} 元
                </dd>
              </div>
              <div className="col-span-2 flex justify-between gap-2">
                <dt className="text-ink/45">报告</dt>
                <dd className="font-medium text-ink">
                  日报{parsed.preview.hasDailyReport ? '有' : '无'} · 周报
                  {parsed.preview.hasWeeklyReport ? '有' : '无'}
                </dd>
              </div>
            </dl>
            <p className="mt-2 rounded-xl bg-[#FBE3DD]/55 px-2.5 py-2 text-[10px] leading-relaxed text-[#8F3F2E]">
              确认后会替换当前 v2 账本、许愿池和报告。建议先导出一份当前备份。
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={restoring}
                onClick={handleRestore}
                className="min-h-11 rounded-xl bg-[#B14E3D] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#9B4334] disabled:cursor-wait disabled:opacity-60"
              >
                {restoring ? '正在恢复…' : '确认恢复并替换当前数据'}
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={() => setParsed(null)}
                className="min-h-11 rounded-xl border border-ink/15 bg-white/70 px-3 text-xs font-medium text-ink/60 transition-colors hover:bg-white disabled:opacity-60"
              >
                取消本次恢复
              </button>
            </div>
          </section>
        )}
      </section>
    </section>
  )
}