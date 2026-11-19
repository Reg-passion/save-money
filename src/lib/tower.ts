import type { IslandState, TowerState, Transaction } from '../types'
import { buildMonsters, type Monster } from './monster'

export const TOWER_ISLAND_HP = 100
export const TOWER_MAX_PER_WAVE = 10

export const TOWER_PATH: Array<{ x: number; y: number }> = [
  { x: -6, y: 58 },
  { x: 20, y: 55 },
  { x: 34, y: 36 },
  { x: 55, y: 43 },
  { x: 67, y: 66 },
  { x: 88, y: 62 },
  { x: 100, y: 38 },
]

export const TOWER_SLOTS: Array<{ x: number; y: number }> = [
  { x: 18, y: 34 },
  { x: 36, y: 62 },
  { x: 50, y: 25 },
  { x: 62, y: 50 },
  { x: 80, y: 78 },
  { x: 92, y: 50 },
  { x: 74, y: 30 },
  { x: 24, y: 76 },
]

export interface TowerWave {
  index: number
  label: string
  monsters: Monster[]
  totalHp: number
}

export interface TowerPlan {
  waves: TowerWave[]
  totalMonsters: number
  totalHp: number
  islandHp: number
}

export function createTowerState(overrides: Partial<TowerState> = {}): TowerState {
  return {
    played: false,
    won: null,
    islandHp: TOWER_ISLAND_HP,
    skipped: false,
    ...overrides,
  }
}

export function buildTowerPlan(
  transactions: Transaction[],
  islandHp = TOWER_ISLAND_HP,
): TowerPlan {
  const waves = buildMonsters(transactions).map((monsters, index) => ({
    index,
    label: ['周一至周三', '周四至周五', '周六至周日'][index],
    monsters,
    totalHp: monsters.reduce((sum, monster) => sum + monster.hp, 0),
  }))
  const totalHp = waves.reduce((sum, wave) => sum + wave.totalHp, 0)
  return {
    waves,
    totalMonsters: waves.reduce((sum, wave) => sum + wave.monsters.length, 0),
    totalHp,
    islandHp: Math.max(0, islandHp - totalHp),
  }
}

export function skipTower(state: IslandState): IslandState {
  return {
    ...state,
    tower: { ...createTowerState(), skipped: true },
  }
}

export function recordTowerResult(
  state: IslandState,
  won: boolean,
): IslandState {
  return {
    ...state,
    tower: {
      ...state.tower,
      played: true,
      won,
      skipped: false,
      islandHp: won ? Math.max(1, state.tower.islandHp) : 0,
    },
  }
}