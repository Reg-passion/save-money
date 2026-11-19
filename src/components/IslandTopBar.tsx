import { WEATHER_LABEL, type IslandSettings, type MonthSummary, type Weather } from '../lib/island'
import { formatCents } from '../lib/money'
import {
  BUILDING_LABELS,
  getProgressPercent,
  getUnlockedBuildings,
} from '../lib/island3d'
import DataBackup from './DataBackup'

const WEATHER_CHIP: Record<Weather, string> = {
  sunny: 'bg-[#EAF4DF]/90 text-[#4C7A34]',
  cloudy: 'bg-[#E8EEF0]/90 text-[#5C7078]',
  overcast: 'bg-[#E2E5EA]/90 text-[#566066]',
  critical: 'bg-[#FBE3DD]/90 text-[#A34A38]',
  repair: 'bg-[#F6E7D2]/90 text-[#94653A]',
}

interface IslandTopBarProps {
  settings: IslandSettings
  summary: MonthSummary
  weather: Weather
  progress: number
  dayNight: number
  soundOn: boolean
  onDayNightChange: (value: number) => void
  onToggleSound: () => void
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 9.5h3.2L13 5.5v13L8.2 14.5H5z" />
      {on ? (
        <>
          <path d="M16 9.2c.8.8 1.2 1.7 1.2 2.8s-.4 2-1.2 2.8" />
          <path d="M18.6 6.8c1.4 1.4 2.1 3.1 2.1 5.2s-.7 3.8-2.1 5.2" />
        </>
      ) : (
        <path d="m16.5 9.5 4 5M20.5 9.5l-4 5" />
      )}
    </svg>
  )
}

export default function IslandTopBar({
  settings,
  summary,
  weather,
  progress,
  dayNight,
  soundOn,
  onDayNightChange,
  onToggleSound,
}: IslandTopBarProps) {
  const percent = getProgressPercent(progress)
  const unlocked = getUnlockedBuildings(progress)
  const stage = BUILDING_LABELS[unlocked[unlocked.length - 1] ?? 'camp']

  return (
    <header className="glass-panel pointer-events-auto sticky top-3 z-20 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[8px] font-semibold tracking-[0.24em] text-ink/35 sm:text-[9px] sm:tracking-[0.34em]">
            MONEY ISLAND
          </p>
          <h1 className="mt-0.5 truncate text-[22px] font-bold leading-tight text-ink">
            {settings.islandName}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-flex ${WEATHER_CHIP[weather]}`}
          >
            {WEATHER_LABEL[weather]}
          </span>
          <div className="flex h-10 items-center gap-1 rounded-full border border-white/55 bg-white/35 px-2">
            <span className="text-[10px] text-ink/35" aria-hidden="true">
              夜
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={dayNight}
              onChange={(event) => onDayNightChange(Number(event.target.value))}
              aria-label="昼夜切换"
              className="day-night-slider w-12 sm:w-20"
            />
            <span className="text-[10px] text-ink/50" aria-hidden="true">
              昼
            </span>
          </div>
          <button
            type="button"
            aria-pressed={soundOn}
            aria-label={soundOn ? '关闭金币音效' : '开启金币音效'}
            title={soundOn ? '关闭金币音效' : '开启金币音效'}
            onClick={onToggleSound}
            className={`glass-icon-button ${soundOn ? 'text-leaf' : 'text-ink/35'}`}
          >
            <SoundIcon on={soundOn} />
          </button>
          <DataBackup />
        </div>
      </div>

      <p className="mt-1 truncate text-[10px] leading-relaxed text-ink/45">
        {summary.monthLabel} · 日均预算 {formatCents(summary.dailyBudgetCents)} 元 · 存钱目标{' '}
        {formatCents(settings.savingsGoalCents)} 元
      </p>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px] text-ink/55">
        <span>
          本月已花{' '}
          <b className="text-sm font-semibold text-ink">{formatCents(summary.spentCents)}</b> /{' '}
          {formatCents(settings.monthlyBudgetCents)} 元
        </span>
        <span className={summary.isOverspent ? 'font-medium text-[#B14E3D]' : ''}>
          {summary.isOverspent
            ? `超支 ${formatCents(Math.abs(summary.remainingCents))} 元`
            : `还剩 ${formatCents(summary.remainingCents)} 元`}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-[9px] text-ink/40">
            <span className="truncate">省钱进度 {percent}%</span>
            <span className="shrink-0 truncate">{stage}</span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/55"
            role="progressbar"
            aria-label="省钱进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6dbb79] via-[#95c97f] to-[#f0c85a] transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold sm:hidden ${WEATHER_CHIP[weather]}`}>
          {WEATHER_LABEL[weather]}
        </span>
      </div>
    </header>
  )
}
