import type { IslandSettings, MonthSummary } from './island'

// 建筑解锁阈值集中在这里，调整小岛生长节奏只改这一处。
export const BUILDING_THRESHOLDS = {
  camp: 0,
  dock: 0.1,
  cabin: 0.3,
  lighthouse: 0.6,
  castle: 0.9,
} as const

export type BuildingId = keyof typeof BUILDING_THRESHOLDS

export const BUILDING_ORDER: BuildingId[] = [
  'camp',
  'dock',
  'cabin',
  'lighthouse',
  'castle',
]

export const BUILDING_LABELS: Record<BuildingId, string> = {
  camp: '荒岛营地',
  dock: '木质码头',
  cabin: '小木屋与风车',
  lighthouse: '灯塔与石桥',
  castle: '山顶城堡',
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** 省钱进度 = 本月预算中尚未花掉的金额 / 存钱目标，封顶 100%。 */
export function getSavingsProgress(
  summary: MonthSummary,
  settings: IslandSettings,
): number {
  const goalCents = Math.max(1, settings.savingsGoalCents)
  const savedCents = Math.max(0, summary.remainingCents)
  return clamp01(savedCents / goalCents)
}

export function getBuildingVisibility(progress: number): Record<BuildingId, boolean> {
  const value = clamp01(progress)
  return {
    camp: value >= BUILDING_THRESHOLDS.camp,
    dock: value >= BUILDING_THRESHOLDS.dock,
    cabin: value >= BUILDING_THRESHOLDS.cabin,
    lighthouse: value >= BUILDING_THRESHOLDS.lighthouse,
    castle: value >= BUILDING_THRESHOLDS.castle,
  }
}

export function getUnlockedBuildings(progress: number): BuildingId[] {
  const visible = getBuildingVisibility(progress)
  return BUILDING_ORDER.filter((building) => visible[building])
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** 0 = 深夜，1 = 白天；默认按本地时间平滑变化。 */
export function getAutoDayNight(date = new Date()): number {
  const hour = date.getHours() + date.getMinutes() / 60
  if (hour <= 5) return 0
  if (hour >= 20) return 0
  if (hour < 10) return smoothstep(5, 10, hour)
  if (hour <= 16) return 1
  return 1 - smoothstep(16, 20, hour)
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function mixHex(from: string, to: string, t: number): string {
  const amount = clamp01(t)
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount)).join(' ')})`
}

export function getSkyGradient(dayNight: number): string {
  const value = clamp01(dayNight)
  const top = mixHex('#071a2a', '#84d4eb', value)
  const middle = mixHex('#183b4c', '#dff4ef', value)
  const horizon = mixHex('#2b5361', '#f7e4bb', value)
  return `linear-gradient(180deg, ${top} 0%, ${middle} 58%, ${horizon} 100%)`
}

export function getProgressPercent(progress: number): number {
  return Math.round(clamp01(progress) * 100)
}
