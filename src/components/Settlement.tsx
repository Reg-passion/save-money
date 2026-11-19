import { useEffect, useState } from 'react'
import { RARE_BONUS_CAP, RARE_TOTAL_CAP } from '../data/constants'
import {
  EGG_TIER_LABEL,
  formatPercent,
  hatchDemoEgg,
  loadDemoEggs,
  loadDemoSettlements,
  loadEggs,
  loadSettlements,
  NO_EGG_REASON_LABEL,
  previewSettlement,
  resetDemoMonth,
  settleDemoMonth,
  settlePendingMonths,
  syncEggHatch,
  type EggCalculation,
  type EggRecord,
  type HatchResult,
  type SettlementRecord,
} from '../lib/egg'
import { formatCents } from '../lib/money'
import type { IslandSettings, MonthSummary } from '../lib/island'
import Egg from './Egg'

interface SettlementProps {
  summary: MonthSummary
  settings: IslandSettings
}

const TIER_CHIP: Record<EggCalculation['tier'], string> = {
  normal: 'bg-[#F4EAD7] text-[#8A6A3C]',
  silver: 'bg-[#E8EFF2] text-[#566E78]',
  gold: 'bg-[#FBEDC0] text-[#8E6415]',
}

function CalculationBreakdown({ calculation }: { calculation: EggCalculation }) {
  const tierLabel = EGG_TIER_LABEL[calculation.tier]

  return (
    <div className="mt-3 rounded-2xl border border-ink/10 bg-cream/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIER_CHIP[calculation.tier]}`}>
          {tierLabel}
        </span>
        <span className="text-[11px] text-ink/50">
          稀有概率 <b className="text-sm font-bold text-ink">{formatPercent(calculation.rareChance)}</b>
        </span>
      </div>

      <dl className="mt-2.5 space-y-1 text-[11px] leading-relaxed text-ink/55">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap">本月已省</dt>
          <dd className="min-w-0 text-right">
            <b className="font-semibold text-ink">{formatCents(calculation.savedCents)} 元</b> / 目标{' '}
            {formatCents(calculation.goalCents)} 元
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap">多存部分</dt>
          <dd className="min-w-0 text-right">{formatCents(calculation.extraSavedCents)} 元</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap">多存加成</dt>
          <dd className="min-w-0 text-right">
            {formatCents(calculation.extraSavedCents)} / {formatCents(calculation.goalCents)} × 30% ={' '}
            {formatPercent(calculation.bonusRate)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap">稀有概率</dt>
          <dd className="min-w-0 text-right">
            {tierLabel}基础 {formatPercent(calculation.baseRate)} + 加成{' '}
            {formatPercent(calculation.bonusRate)} ={' '}
            <b className="font-semibold text-ink">{formatPercent(calculation.rareChance)}</b>
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[10px] leading-relaxed text-ink/35">
        多存加成上限 +{formatPercent(RARE_BONUS_CAP)}，总概率封顶 {formatPercent(RARE_TOTAL_CAP)}
        {calculation.bonusCapped ? ' · 加成已封顶' : ''}
        {calculation.totalCapped ? ' · 总概率已封顶' : ''}
      </p>
    </div>
  )
}

function NoEggNote({ record }: { record: SettlementRecord }) {
  return (
    <div className="mt-3 rounded-2xl border border-[#E4BE93] bg-[#FBF0E0] px-3 py-3 text-[11px] leading-relaxed text-[#8A5A2B]">
      <p className="font-semibold">这个月没有蛋</p>
      <p className="mt-1">
        {record.noEggReason === 'overspent'
          ? `本月超预算 ${formatCents(Math.abs(record.savedCents))} 元。`
          : record.noEggReason === 'zero-hp'
            ? '岛血量已经归 0。'
            : NO_EGG_REASON_LABEL[record.noEggReason ?? 'no-bills']}
      </p>
      <p className="mt-1 text-[#9A6B3E]/80">
        本月已花 {formatCents(record.spentCents)} / {formatCents(record.budgetCents)} 元 · 岛血{' '}
        {record.hp} / 100
      </p>
    </div>
  )
}

function SettlementResult({ record }: { record: SettlementRecord }) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink">
          {record.monthLabel}结算
        </span>
        {record.demo && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/40">
            演示 · 独立存储
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            record.hasEgg ? 'bg-[#EDF6E5] text-[#4F7B39]' : 'bg-[#F5EDE4] text-[#8E6A4A]'
          }`}
        >
          {record.hasEgg ? '已获得蛋' : '没有蛋'}
        </span>
      </div>

      {record.hasEgg && record.calculation ? (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-ink/45">
            本月已花 {formatCents(record.spentCents)} / {formatCents(record.budgetCents)} 元 · 岛血{' '}
            {record.hp} / 100
          </p>
          <CalculationBreakdown calculation={record.calculation} />
          <p className="mt-2 text-[11px] leading-relaxed text-leaf">
            {record.demo
              ? '演示蛋在下面的演示孵化栏，可随时重置。'
              : '蛋已经放进孵化栏：每天记一笔，3 天后孵出精灵。'}
          </p>
        </>
      ) : (
        <NoEggNote record={record} />
      )}
    </div>
  )
}

export default function Settlement({ summary, settings }: SettlementProps) {
  const [settlements, setSettlements] = useState<SettlementRecord[]>(() => loadSettlements())
  const [eggs, setEggs] = useState<EggRecord[]>(() => loadEggs())
  const [demoSettlements, setDemoSettlements] = useState<SettlementRecord[]>(() =>
    loadDemoSettlements(),
  )
  const [demoEggs, setDemoEggs] = useState<EggRecord[]>(() => loadDemoEggs())
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const created = settlePendingMonths()
      setSettlements(loadSettlements())
      setEggs(syncEggHatch())
      if (created.length > 0) {
        setNotice(`已补结算 ${created.length} 个历史月份，正式结果不受演示影响。`)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [summary.bills.length, summary.monthLabel])

  const preview = previewSettlement(summary, settings)
  const currentSettlement = settlements.find((record) => record.monthKey === preview.monthKey)
  const latestPast =
    [...settlements].reverse().find((record) => record.monthKey < preview.monthKey) ?? null
  const demoCurrent = demoSettlements.find((record) => record.monthKey === preview.monthKey)

  function handleDemoSettle() {
    try {
      const record = settleDemoMonth(new Date(), { bills: summary.bills, settings })
      setDemoSettlements(loadDemoSettlements())
      setDemoEggs(loadDemoEggs())
      setNotice(
        record
          ? record.hasEgg
            ? '演示结算完成：蛋在演示孵化栏，可随时重置。'
            : '演示结算完成：这个月没有蛋。'
          : '本月还没有账单，无法演示结算。',
      )
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '演示结算失败')
    }
  }

  function handleResetDemo() {
    const removed = resetDemoMonth(preview.monthKey)
    setDemoSettlements(loadDemoSettlements())
    setDemoEggs(loadDemoEggs())
    setNotice(removed ? '演示数据已重置，正式结算不受影响。' : '没有可重置的演示数据。')
  }

  function handleDemoHatch(eggId: string): HatchResult | null {
    const result = hatchDemoEgg(eggId)
    setDemoEggs(loadDemoEggs())
    return result
  }

  const savedLabel =
    preview.savedCents >= 0
      ? `已省 ${formatCents(preview.savedCents)} 元`
      : `超支 ${formatCents(Math.abs(preview.savedCents))} 元`

  return (
    <>
      <section className="rounded-3xl border border-ink/10 bg-white/65 p-4" aria-labelledby="settlement-title">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.3em] text-ink/35">MONTHLY EGG</p>
            <h2 id="settlement-title" className="mt-1 text-sm font-bold text-ink">
              月底结算
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-ink/35">
              普通蛋 &lt;100 · 银蛋 100–300 · 金蛋 &gt;300
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-ink/50">
            {currentSettlement ? '本月已结算' : preview.hasBills ? '结算预览' : '等待账单'}
          </span>
        </header>

        {notice && (
          <p role="status" className="mt-3 rounded-2xl bg-[#EDF6E5] px-3 py-2 text-[11px] leading-relaxed text-[#4F7B39]">
            {notice}
          </p>
        )}

        {currentSettlement ? (
          <SettlementResult record={currentSettlement} />
        ) : (
          <>
            {latestPast && (
              <details className="mt-3 rounded-2xl bg-ink/5">
                <summary className="flex min-h-10 cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-[11px] text-ink/50">
                  <span>上次结算 · {latestPast.monthLabel}</span>
                  <span>
                    {latestPast.hasEgg && latestPast.calculation
                      ? `${EGG_TIER_LABEL[latestPast.calculation.tier]} · ${formatPercent(latestPast.calculation.rareChance)}`
                      : NO_EGG_REASON_LABEL[latestPast.noEggReason ?? 'no-bills']}
                  </span>
                </summary>
                <div className="px-3 pb-3">
                  {latestPast.hasEgg && latestPast.calculation ? (
                    <CalculationBreakdown calculation={latestPast.calculation} />
                  ) : (
                    <NoEggNote record={latestPast} />
                  )}
                </div>
              </details>
            )}

            {preview.hasBills ? (
              <>
                <p className="mt-3 text-xs font-semibold text-ink">
                  {preview.monthLabel} · {savedLabel}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
                  本月已花 {formatCents(preview.spentCents)} / {formatCents(preview.budgetCents)} 元 · 岛血{' '}
                  {preview.hp} / 100
                </p>

                {preview.hasEgg && preview.calculation ? (
                  <>
                    <CalculationBreakdown calculation={preview.calculation} />
                    <p className="mt-2 text-[11px] leading-relaxed text-ink/40">
                      月底结算时，如果岛血仍然 &gt; 0，就按上面的概率收下 1 枚蛋。
                    </p>
                  </>
                ) : (
                  <div className="mt-3 rounded-2xl border border-[#E4BE93] bg-[#FBF0E0] px-3 py-3 text-[11px] leading-relaxed text-[#8A5A2B]">
                    <p className="font-semibold">月底不会有蛋</p>
                    <p className="mt-1">
                      {preview.noEggReason === 'overspent'
                        ? `本月已超预算 ${formatCents(Math.abs(preview.savedCents))} 元。`
                        : preview.noEggReason === 'zero-hp'
                          ? '岛血量为 0，撑不到结算。'
                          : '本月还没有账单。'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white/45 px-4 py-6 text-center text-xs leading-relaxed text-ink/45">
                本月还没有账单。月底岛血 &gt; 0 且没有超预算，才会收到 1 枚蛋。
              </p>
            )}
          </>
        )}

        <div className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.03] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-ink/35">DEMO</p>
              <p className="text-xs font-semibold text-ink">演示结算</p>
            </div>
            {demoCurrent && (
              <button
                type="button"
                onClick={handleResetDemo}
                className="min-h-9 rounded-xl border border-ink/15 bg-white/70 px-2.5 text-[11px] font-medium text-ink/55 transition-colors hover:bg-white hover:text-ink"
              >
                重置演示
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-ink/40">
            独立存储：不锁定本月正式结算，也不写入正式图鉴。
          </p>

          {demoCurrent ? (
            <SettlementResult record={demoCurrent} />
          ) : preview.hasBills ? (
            <button
              type="button"
              onClick={handleDemoSettle}
              className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-white/75 px-3 text-xs font-medium text-ink/60 transition-colors hover:bg-white hover:text-ink"
            >
              演示结算本月（不影响正式结算）
            </button>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-ink/15 bg-white/45 px-3 py-4 text-center text-[11px] text-ink/40">
              本月还没有账单，暂不能演示。
            </p>
          )}
        </div>

        <p className="mt-3 border-t border-ink/5 pt-2 text-[10px] leading-relaxed text-ink/35">
          下月自动重开，图鉴和已孵精灵都不清零。正式结算每月只做一次。
        </p>
      </section>

      <Egg eggs={eggs} />

      {demoEggs.length > 0 && (
        <Egg eggs={demoEggs} variant="demo" onDemoHatch={handleDemoHatch} />
      )}
    </>
  )
}
