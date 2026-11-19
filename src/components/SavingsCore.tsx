import { formatCents } from '../lib/money'

interface SavingsCoreProps {
  todaySpentCents: number
  dailyBudgetCents: number
  weekSpentCents: number
  weeklyBudgetCents: number
  todayScore: number
  todayBillCount: number
  codexProgress: number
  codexTotal: number
  summonedToday: number
  summonLimit: number
}

export default function SavingsCore({
  todaySpentCents,
  dailyBudgetCents,
  weekSpentCents,
  weeklyBudgetCents,
  todayScore,
  todayBillCount,
  codexProgress,
  codexTotal,
  summonedToday,
  summonLimit,
}: SavingsCoreProps) {
  const usedPercent = Math.min(
    100,
    Math.round((todaySpentCents / Math.max(1, dailyBudgetCents)) * 100),
  )
  const weekPercent = Math.min(
    100,
    Math.round((weekSpentCents / Math.max(1, weeklyBudgetCents)) * 100),
  )
  const remainingCents = Math.max(0, dailyBudgetCents - todaySpentCents)
  const overBudget = todaySpentCents > dailyBudgetCents
  const ringColor = overBudget ? '#D7775E' : usedPercent >= 80 ? '#D8B24C' : '#5FA96B'
  const tip = overBudget
    ? `今天超出日预算 ${formatCents(todaySpentCents - dailyBudgetCents)} 元，明天重新守住。`
    : todaySpentCents <= 0
      ? '今天还没有记账，第一笔会召唤一只精灵。'
      : todayScore >= 15
        ? '今天的支出在日预算 80% 以内，保持这个节奏。'
        : '今天守住了日预算，还剩一点余量。'

  return (
    <section className="glass-panel pointer-events-auto p-4" aria-labelledby="savings-core-title">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-leaf">SAVINGS CORE</p>
          <h2 id="savings-core-title" className="mt-1 text-base font-bold text-ink">
            存钱核心
          </h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            todayScore > 0 ? 'bg-[#EAF4DF] text-[#4C7A34]' : 'bg-[#FBE3DD] text-[#A34A38]'
          }`}
        >
          今天 +{todayScore}
        </span>
      </header>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="relative flex h-[116px] w-[116px] shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${ringColor} ${usedPercent * 3.6}deg, rgba(255,255,255,0.55) 0deg)`,
          }}
          role="img"
          aria-label={`今日已花 ${formatCents(todaySpentCents)} 元，日预算 ${formatCents(dailyBudgetCents)} 元`}
        >
          <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-[#FFFCF3] text-center shadow-inner">
            <span className="text-[10px] text-ink/40">今日已花</span>
            <span className="mt-0.5 text-xl font-bold leading-none text-ink">
              {formatCents(todaySpentCents)}
            </span>
            <span className="mt-1 text-[10px] text-ink/40">
              / {formatCents(dailyBudgetCents)} 元
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink/45">
              <span>本周预算</span>
              <span className="tabular-nums">
                {formatCents(weekSpentCents)} / {formatCents(weeklyBudgetCents)} 元
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6dbb79] to-[#f0c85a]"
                style={{ width: `${weekPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/55 bg-white/35 px-2.5 py-2">
              <p className="text-[9px] text-ink/40">图鉴</p>
              <p className="mt-0.5 text-sm font-bold text-ink">
                {codexProgress}/{codexTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-white/55 bg-white/35 px-2.5 py-2">
              <p className="text-[9px] text-ink/40">今日精灵</p>
              <p className="mt-0.5 text-sm font-bold text-ink">
                {summonedToday}/{summonLimit}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-ink/45">
            <span>今天 {todayBillCount} 笔</span>
            <span>{overBudget ? '超出日预算' : `还剩 ${formatCents(remainingCents)} 元`}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 rounded-2xl border border-white/60 bg-white/35 px-3 py-2 text-[11px] leading-relaxed text-ink/55">
        {tip}
      </p>
    </section>
  )
}