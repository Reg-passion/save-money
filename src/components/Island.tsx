import { useId, useState, type FormEvent } from 'react'
import {
  WEATHER_LABEL,
  type IslandSettings,
  type MonthSummary,
  type Weather,
} from '../lib/island'
import { centsToInputValue, formatCents, parseYuanToCents } from '../lib/money'

interface IslandProps {
  settings: IslandSettings
  summary: MonthSummary
  weather: Weather
  onSaveSettings: (next: IslandSettings) => void
}

interface Palette {
  halo: string
  sea: string
  sand: string
  grass: string
  grassLight: string
  leaf: string
  leafDark: string
  window: string
  cloud: string
}

const PALETTES: Record<Weather, Palette> = {
  sunny: {
    halo: '#E3F2F0',
    sea: '#7FC8D9',
    sand: '#F2D9A6',
    grass: '#9BCB8A',
    grassLight: '#A9D49A',
    leaf: '#6DB87A',
    leafDark: '#5FA96B',
    window: '#FFD97A',
    cloud: '#FFFFFF',
  },
  cloudy: {
    halo: '#E6EDEE',
    sea: '#84BFCC',
    sand: '#EFD7AA',
    grass: '#94C084',
    grassLight: '#A2CA92',
    leaf: '#68AE75',
    leafDark: '#599D66',
    window: '#E8CF8A',
    cloud: '#F7FAFA',
  },
  overcast: {
    halo: '#DFE5E6',
    sea: '#7DAAB6',
    sand: '#E9D3AA',
    grass: '#8BB07F',
    grassLight: '#99BC8C',
    leaf: '#5F9E6C',
    leafDark: '#528D5F',
    window: '#CDB87E',
    cloud: '#E9EFF0',
  },
  critical: {
    halo: '#DDDCE2',
    sea: '#6F97A6',
    sand: '#DECBA6',
    grass: '#81A077',
    grassLight: '#8FAD83',
    leaf: '#578D64',
    leafDark: '#4B7C57',
    window: '#B9A877',
    cloud: '#C9D3D6',
  },
  repair: {
    halo: '#E9E1D6',
    sea: '#8BA5AC',
    sand: '#E7D4AE',
    grass: '#A0AB85',
    grassLight: '#ADB893',
    leaf: '#7F9A6E',
    leafDark: '#6F8A60',
    window: '#C8B887',
    cloud: '#EFEAE0',
  },
}

const WEATHER_CHIP: Record<Weather, string> = {
  sunny: 'bg-[#EAF4DF] text-[#4C7A34]',
  cloudy: 'bg-[#E8EEF0] text-[#5C7078]',
  overcast: 'bg-[#E2E5EA] text-[#566066]',
  critical: 'bg-[#FBE3DD] text-[#A34A38]',
  repair: 'bg-[#F6E7D2] text-[#94653A]',
}

const HP_BAR_COLOR: Record<Weather, string> = {
  sunny: '#5FA96B',
  cloudy: '#D6A94E',
  overcast: '#DD8B4F',
  critical: '#D96B5F',
  repair: '#C98A5C',
}

function Cloud({
  x,
  y,
  scale,
  fill,
  opacity = 0.9,
}: {
  x: number
  y: number
  scale: number
  fill: string
  opacity?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={fill} opacity={opacity}>
      <ellipse cx="0" cy="4" rx="18" ry="9" />
      <circle cx="-10" cy="0" r="8" />
      <circle cx="10" cy="-2" r="10" />
    </g>
  )
}

function Tree({
  x,
  y,
  scale,
  leaf,
  leafDark,
}: {
  x: number
  y: number
  scale: number
  leaf: string
  leafDark: string
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-3" y="-10" width="6" height="20" rx="3" fill="#A9794F" />
      <circle cx="-4" cy="-22" r="13" fill={leaf} />
      <circle cx="5" cy="-19" r="10" fill={leafDark} />
      <circle cx="-11" cy="-15" r="7" fill={leafDark} />
    </g>
  )
}

export function IslandScene({ hp, weather }: { hp: number; weather: Weather }) {
  const palette = PALETTES[weather]
  const treeCount = hp > 65 ? 3 : hp > 35 ? 2 : hp > 10 ? 1 : 0
  const lit = hp > 50
  const dim = weather === 'repair' ? 0.52 : 0.62 + (hp / 100) * 0.38

  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label={`岛屿当前天气${WEATHER_LABEL[weather]}，岛血量 ${hp} / 100`}
      className="h-auto w-full"
    >
      <circle cx="160" cy="160" r="152" fill={palette.halo} />

      {weather === 'sunny' && (
        <g>
          <circle cx="266" cy="58" r="24" fill="#FFE3A1" opacity="0.25" />
          <circle cx="266" cy="58" r="15" fill="#FFE3A1" />
        </g>
      )}

      <g opacity={dim}>
        <circle cx="160" cy="160" r="132" fill={palette.sea} />
        <circle
          cx="160"
          cy="160"
          r="132"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.35"
          strokeWidth="3"
          strokeDasharray="2 12"
          strokeLinecap="round"
        />
        <g stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M42 150c4-4 8-4 12 0" />
          <path d="M258 208c4-4 8-4 12 0" />
          <path d="M226 72c4-4 8-4 12 0" />
        </g>

        <circle cx="160" cy="162" r="113" fill={palette.sand} />
        <circle
          cx="160"
          cy="162"
          r="113"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.5"
          strokeWidth="4"
          strokeDasharray="20 16"
          strokeLinecap="round"
        />
        <circle cx="158" cy="158" r="96" fill={palette.grass} />
        <ellipse cx="138" cy="132" rx="62" ry="40" fill={palette.grassLight} opacity="0.55" />

        <g fill="#D9B97C" opacity="0.5">
          <circle cx="56" cy="150" r="2.5" />
          <circle cx="146" cy="266" r="2.5" />
          <circle cx="254" cy="120" r="2" />
        </g>

        <path
          d="M201 214c-4 12 4 20 2 30"
          stroke="#F7E5BE"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />

        <g>
          <circle cx="116" cy="196" r="10" fill={palette.leaf} />
          <circle cx="126" cy="200" r="7" fill={palette.leafDark} />
        </g>

        {treeCount >= 1 && (
          <Tree x={104} y={132} scale={1} leaf={palette.leaf} leafDark={palette.leafDark} />
        )}
        {treeCount >= 2 && (
          <Tree x={216} y={140} scale={0.8} leaf={palette.leaf} leafDark={palette.leafDark} />
        )}
        {treeCount >= 3 && (
          <Tree x={150} y={214} scale={0.7} leaf={palette.leaf} leafDark={palette.leafDark} />
        )}

        <ellipse cx="202" cy="215" rx="21" ry="5" fill="#2F4147" opacity="0.08" />
        <rect x="184" y="184" width="36" height="30" rx="4" fill="#FFF6E4" />
        <path d="M179 186 202 168l23 18z" fill="#F09A7E" />
        <rect x="196" y="198" width="9" height="16" rx="2" fill="#A9794F" />
        {lit && <circle cx="189" cy="194" r="7" fill={palette.window} opacity="0.35" />}
        <circle cx="189" cy="194" r="3" fill={lit ? palette.window : '#C9BCA2'} />

        {weather === 'repair' && (
          <g stroke="#F3E7CF" strokeLinecap="round" opacity="0.95">
            <path d="M182 184l38 14" strokeWidth="7" />
            <path d="M188 197l28-17" strokeWidth="6" />
          </g>
        )}

        <g
          stroke={palette.leafDark}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        >
          <path d="M128 150v-6M124 148l-3-4M132 148l3-4" />
          <path d="M180 226v-6M176 224l-3-4M184 224l3-4" />
          <path d="M150 108v-6M146 106l-3-4M154 106l3-4" />
        </g>
        <g fill="#FFF6E4" opacity="0.9">
          <circle cx="170" cy="140" r="2.5" />
          <circle cx="178" cy="144" r="2" />
          <circle cx="136" cy="180" r="2" />
        </g>

        {hp < 10 && (
          <g stroke="#5D7660" strokeWidth="2" strokeLinecap="round" opacity="0.45" fill="none">
            <path d="M120 140l8 10-4 9" />
            <path d="M196 130l-6 9 5 7" />
            <path d="M150 186l9 6-3 9" />
          </g>
        )}
      </g>

      {weather === 'sunny' && <Cloud x={52} y={70} scale={1} fill="#FFFFFF" />}
      {(weather === 'cloudy' || weather === 'overcast' || weather === 'critical') && (
        <>
          <Cloud x={52} y={70} scale={1} fill={palette.cloud} opacity={0.95} />
          <Cloud x={272} y={92} scale={0.8} fill={palette.cloud} opacity={0.85} />
        </>
      )}
      {weather === 'overcast' && (
        <Cloud x={222} y={40} scale={0.6} fill={palette.cloud} opacity={0.7} />
      )}
      {weather === 'repair' && <Cloud x={52} y={70} scale={0.9} fill={palette.cloud} opacity={0.8} />}

      {(weather === 'critical' || weather === 'repair') && (
        <g
          stroke="#5E7C88"
          strokeOpacity={weather === 'repair' ? 0.35 : 0.45}
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M80 60l-8 22" />
          <path d="M108 44l-8 22" />
          <path d="M138 66l-8 22" />
          <path d="M170 48l-8 22" />
          <path d="M200 68l-8 22" />
          <path d="M228 50l-8 22" />
          <path d="M254 72l-8 22" />
          <path d="M92 108l-8 22" />
          <path d="M240 116l-8 22" />
        </g>
      )}

      {weather === 'sunny' && (
        <g fill="#FFF6C9">
          <path d="M120 72l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" />
          <path d="M204 84l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" opacity="0.8" />
        </g>
      )}

      {(weather === 'sunny' || weather === 'cloudy') && (
        <g stroke="#2F4147" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M84 42c2.5-2.5 5-2.5 7.5 0" />
          <path d="M96 36c2.5-2.5 5-2.5 7.5 0" />
        </g>
      )}
    </svg>
  )
}

export default function Island({ settings, summary, weather, onSaveSettings }: IslandProps) {
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const titleId = useId()

  function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const islandName = String(form.get('islandName') ?? '').trim()
    const monthlyBudgetCents = parseYuanToCents(String(form.get('monthlyBudget') ?? ''))
    const savingsGoalCents = parseYuanToCents(String(form.get('savingsGoal') ?? ''))

    if (!islandName || monthlyBudgetCents === null || savingsGoalCents === null) {
      setSettingsMessage('预算、目标和岛名都需要填写有效值。')
      return
    }

    try {
      onSaveSettings({ islandName, monthlyBudgetCents, savingsGoalCents })
      setSettingsMessage('设定已保存。')
    } catch {
      setSettingsMessage('设定没有保存成功，请检查浏览器存储权限。')
    }
  }

  return (
    <section className="glass-panel pointer-events-auto p-4" aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-ink/35">ISLAND STATUS</p>
          <h2 id={titleId} className="mt-1 text-sm font-bold text-ink">
            岛况
          </h2>
          <p className="mt-1 text-[10px] leading-relaxed text-ink/45">
            本月预算里没花掉的部分会变成小岛建筑；超支会进入修补模式。
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${WEATHER_CHIP[weather]}`}
        >
          {WEATHER_LABEL[weather]}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-xs text-ink/50">岛血量</span>
        <span className="text-2xl font-bold leading-none text-ink">{summary.hp}</span>
        <span className="text-xs font-medium text-ink/40">/ 100</span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-white/50"
        role="progressbar"
        aria-label="岛血量"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.hp}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${summary.hp}%`, backgroundColor: HP_BAR_COLOR[weather] }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] text-ink/55">
        <span>
          本月已花{' '}
          <b className="font-semibold text-ink">{formatCents(summary.spentCents)}</b> /{' '}
          {formatCents(settings.monthlyBudgetCents)} 元
        </span>
        <span className={summary.isOverspent ? 'font-medium text-[#B14E3D]' : ''}>
          {summary.isOverspent
            ? `超支 ${formatCents(Math.abs(summary.remainingCents))} 元`
            : `还剩 ${formatCents(summary.remainingCents)} 元`}
        </span>
      </div>

      {weather === 'repair' && (
        <div
          className="mt-3 rounded-2xl border border-[#E4BE93]/80 bg-[#FBF0E0]/85 px-4 py-3 text-xs leading-relaxed text-[#8A5A2B]"
          role="status"
        >
          {summary.isOverspent
            ? `本月已超预算 ${formatCents(Math.abs(summary.remainingCents))} 元，岛进入修补模式；下月自动重开，图鉴不清零。`
            : '岛血量为 0，进入修补模式；下月自动重开，图鉴不清零。'}
        </div>
      )}

      <details
        id="island-settings"
        className="mt-3 scroll-mt-44 rounded-2xl border border-white/55 bg-white/35"
      >
        <summary className="flex min-h-12 cursor-pointer select-none items-center px-4 text-xs font-medium text-ink/55">
          开岛设定 · 预算 / 目标 / 岛名
        </summary>
        <form
          aria-label="开岛设定"
          className="grid gap-3 px-4 pb-4"
          onSubmit={handleSettingsSubmit}
        >
          <label className="grid gap-1">
            <span className="text-[11px] font-medium text-ink/45">岛名</span>
            <input
              name="islandName"
              defaultValue={settings.islandName}
              required
              maxLength={12}
              className="h-12 rounded-xl border border-white/70 bg-white/80 px-3 text-base text-ink outline-none focus:border-leaf"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-medium text-ink/45">月预算（元）</span>
              <input
                name="monthlyBudget"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={centsToInputValue(settings.monthlyBudgetCents)}
                required
                className="h-12 w-full rounded-xl border border-white/70 bg-white/80 px-3 text-base text-ink outline-none focus:border-leaf"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-medium text-ink/45">存钱目标（元）</span>
              <input
                name="savingsGoal"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={centsToInputValue(settings.savingsGoalCents)}
                required
                className="h-12 w-full rounded-xl border border-white/70 bg-white/80 px-3 text-base text-ink outline-none focus:border-leaf"
              />
            </label>
          </div>
          <button
            type="submit"
            className="h-12 rounded-xl bg-ink text-sm font-semibold text-cream transition-colors hover:bg-ink/90"
          >
            保存设定
          </button>
          <p role="status" className="min-h-4 text-center text-[11px] text-ink/45">
            {settingsMessage ?? ''}
          </p>
        </form>
      </details>
    </section>
  )
}
