import { WEATHER_LABEL, type Weather } from '../lib/island'
import { formatCents } from '../lib/money'
import DataBackup from './DataBackup'

const WEATHER_CHIP: Record<Weather, string> = {
  sunny: 'bg-[#EAF4DF]/90 text-[#4C7A34]',
  cloudy: 'bg-[#E8EEF0]/90 text-[#5C7078]',
  overcast: 'bg-[#E2E5EA]/90 text-[#566066]',
  critical: 'bg-[#FBE3DD]/90 text-[#A34A38]',
  repair: 'bg-[#F6E7D2]/90 text-[#94653A]',
}

interface IslandTopBarProps {
  islandName: string
  weather: Weather
  dayNight: number
  soundOn: boolean
  onDayNightChange: (value: number) => void
  onToggleSound: () => void
  todaySpentCents: number
  dailyBudgetCents: number
  weekSpentCents: number
  weeklyBudgetCents: number
  codexProgress: number
  codexTotal: number
  summonedToday: number
  summonLimit: number
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
  islandName,
  weather,
  dayNight,
  soundOn,
  onDayNightChange,
  onToggleSound,
  todaySpentCents,
  dailyBudgetCents,
  weekSpentCents,
  weeklyBudgetCents,
  codexProgress,
  codexTotal,
  summonedToday,
  summonLimit,
}: IslandTopBarProps) {
  const dayPercent = Math.min(
    100,
    Math.round((todaySpentCents / Math.max(1, dailyBudgetCents)) * 100),
  )

  return (
    <header className="glass-panel pointer-events-auto sticky top-2 z-20 px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="hidden text-[8px] font-semibold tracking-[0.28em] text-ink/30 sm:inline">
              MONEY ISLAND
            </span>
            <h1 className="truncate text-base font-bold leading-tight text-ink sm:text-lg">
              {islandName}
            </h1>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${WEATHER_CHIP[weather]}`}
            >
              {WEATHER_LABEL[weather]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-ink/45">
            <span>
              今日{' '}
              <b className={todaySpentCents > dailyBudgetCents ? 'text-[#B14E3D]' : 'text-ink'}>
                {formatCents(todaySpentCents)}
              </b>{' '}
              / {formatCents(dailyBudgetCents)} 元
            </span>
            <span>
              本周{' '}
              <b className="text-ink">{formatCents(weekSpentCents)}</b> /{' '}
              {formatCents(weeklyBudgetCents)} 元
            </span>
            <span>
              图鉴{' '}
              <b className="text-ink">
                {codexProgress}/{codexTotal}
              </b>
            </span>
            <span>
              精灵{' '}
              <b className="text-ink">
                {summonedToday}/{summonLimit}
              </b>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden h-9 items-center gap-1 rounded-full border border-white/55 bg-white/35 px-2 md:flex">
            <span className="text-[9px] text-ink/35" aria-hidden="true">
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
              className="day-night-slider w-14"
            />
            <span className="text-[9px] text-ink/50" aria-hidden="true">
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

      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/55"
        role="progressbar"
        aria-label="今日预算使用"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={dayPercent}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            todaySpentCents > dailyBudgetCents
              ? 'bg-[#D7775E]'
              : 'bg-gradient-to-r from-[#6dbb79] to-[#f0c85a]'
          }`}
          style={{ width: `${dayPercent}%` }}
        />
      </div>
    </header>
  )
}