import type { IslandState, TowerState, Transaction } from '../types'
import { addDays, startOfWeek, toDateKey } from './budget'
import { SPIRIT_BY_ID, type Spirit } from '../data/catalog'
import { readJSON, writeJSON } from './storage'
import { buildMonsters, MONSTER_WAVE_LABELS, type Monster } from './monster'

export const TOWER_ISLAND_HP = 100
export const TOWER_MAX_PER_WAVE = 10
export const GRID_COLUMNS = 8
export const GRID_ROWS = 5

export const PATH: Array<{ x: number; y: number }> = [
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 1 },
  { x: 2, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 2 },
  { x: 7, y: 2 },
]

export const SLOTS: Array<{ x: number; y: number }> = [
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 6, y: 1 },
  { x: 6, y: 3 },
]

export const TOWER_PATH = PATH
export const TOWER_SLOTS = SLOTS
export const TOWER_REWARD_KEY = 'tower-rewards-v1'
export const TOWER_WEEK_KEY = 'tower-week-v1'

export const ATTACK_INTERVAL_SECONDS = 1
export const MONSTER_SPEED_SCALE = 0.5
export const SPAWN_INTERVAL_SECONDS = 5.5
export const WAVE_GAP_SECONDS = 7
export const FIRST_SPAWN_SECONDS = 10

const ATTACK_BY_RARITY: Record<Spirit['rarity'], number> = {
  normal: 1,
  rare: 2,
  hidden: 3,
}

const RANGE_BY_RARITY: Record<Spirit['rarity'], number> = {
  normal: 2,
  rare: 2,
  hidden: 3,
}

interface GridPoint {
  x: number
  y: number
}

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

export interface BattleMonster {
  key: string
  source: Monster
  waveIndex: number
  progress: number
  hp: number
  maxHp: number
  x: number
  y: number
  speed: number
}

export interface BattleDefender {
  id: string
  spirit: Spirit
  slot: GridPoint
  attack: number
  range: number
  cooldown: number
}

export type BattleStatus = 'running' | 'won' | 'lost'

export type BattleEvent =
  | { type: 'spawn'; monsterKey: string; monster: BattleMonster }
  | { type: 'hit'; monsterKey: string; defenderId: string; damage: number }
  | { type: 'kill'; monsterKey: string }
  | { type: 'leak'; monsterKey: string; damage: number; x: number; y: number }
  | { type: 'wave'; waveIndex: number }
  | { type: 'end'; status: 'won' | 'lost' }

export interface TowerBattle {
  plan: TowerPlan
  waves: Monster[][]
  defenders: BattleDefender[]
  monsters: BattleMonster[]
  waveIndex: number
  spawnIndex: number
  spawnTimer: number
  spawnInterval: number
  waveGap: number
  announcedWave: number
  islandHp: number
  maxIslandHp: number
  elapsed: number
  status: BattleStatus
  events: BattleEvent[]
  serial: number
}

export interface TowerRewardState {
  seeds: number
  lastWinWeek: string | null
  pendingEggBonus: { weekStart: string; points: number } | null
}

export interface TowerGameResult {
  state: IslandState
  won: boolean
  islandHp: number
  weekStart: string
  nextWeekStart: string
  seedEarned: boolean
  eggBonus: number
  reward: TowerRewardState
}

function emptyTowerReward(): TowerRewardState {
  return { seeds: 0, lastWinWeek: null, pendingEggBonus: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function loadTowerReward(): TowerRewardState {
  const raw = readJSON<unknown>(TOWER_REWARD_KEY, null)
  if (!isRecord(raw)) return emptyTowerReward()
  const bonus = isRecord(raw.pendingEggBonus) ? raw.pendingEggBonus : null
  return {
    seeds:
      typeof raw.seeds === 'number' && Number.isFinite(raw.seeds) && raw.seeds > 0
        ? Math.floor(raw.seeds)
        : 0,
    lastWinWeek: typeof raw.lastWinWeek === 'string' ? raw.lastWinWeek : null,
    pendingEggBonus:
      bonus &&
      typeof bonus.weekStart === 'string' &&
      typeof bonus.points === 'number' &&
      Number.isFinite(bonus.points) &&
      bonus.points > 0
        ? { weekStart: bonus.weekStart, points: Math.floor(bonus.points) }
        : null,
  }
}

export function getEggBonusForWeek(weekStart: string): number {
  const reward = loadTowerReward()
  return reward.pendingEggBonus?.weekStart === weekStart
    ? reward.pendingEggBonus.points
    : 0
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

export function getActiveTowerWeek(state: IslandState, now = new Date()): string | null {
  const currentWeek = toDateKey(startOfWeek(now))
  if (!state.egg.hatched || state.egg.cycleStart !== currentWeek) return null
  return currentWeek
}

export function transactionsForWeek(
  transactions: Transaction[],
  weekStart: string,
): Transaction[] {
  const monday = new Date(`${weekStart}T00:00:00`)
  if (Number.isNaN(monday.getTime())) return []
  const sunday = toDateKey(addDays(monday, 6))
  return transactions.filter(
    (transaction) => transaction.date >= weekStart && transaction.date <= sunday,
  )
}

export function buildTowerPlan(
  transactions: Transaction[],
  islandHp = TOWER_ISLAND_HP,
  weekStart?: string,
): TowerPlan {
  const scoped = weekStart ? transactionsForWeek(transactions, weekStart) : transactions
  const waves = buildMonsters(scoped).map((monsters, index) => ({
    index,
    label: MONSTER_WAVE_LABELS[index],
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

export function syncTowerWeek(state: IslandState, now = new Date()): IslandState {
  const activeWeek = getActiveTowerWeek(state, now)
  if (!activeWeek) return state
  if (readJSON<string>(TOWER_WEEK_KEY, '') === activeWeek) return state
  writeJSON(TOWER_WEEK_KEY, activeWeek)
  const resolved =
    state.tower.played ||
    state.tower.skipped ||
    state.tower.won !== null ||
    state.tower.islandHp !== TOWER_ISLAND_HP
  return resolved ? { ...state, tower: createTowerState() } : state
}

export function skipTower(state: IslandState, now = new Date()): IslandState {
  const weekStart = getActiveTowerWeek(state, now) ?? toDateKey(startOfWeek(now))
  writeJSON(TOWER_WEEK_KEY, weekStart)
  return {
    ...state,
    egg: { ...state.egg, skippedTower: true },
    tower: { ...createTowerState(), skipped: true },
  }
}

export function recordTowerResult(
  state: IslandState,
  won: boolean,
  islandHp = state.tower.islandHp,
) {
  return resolveTowerGame(state, won, islandHp).state
}

export function resolveTowerGame(
  state: IslandState,
  won: boolean,
  islandHp = state.tower.islandHp,
  now = new Date(),
): TowerGameResult {
  const weekStart =
    getActiveTowerWeek(state, now) ?? (state.egg.cycleStart || toDateKey(startOfWeek(now)))
  const nextWeekStart = toDateKey(addDays(new Date(`${weekStart}T00:00:00`), 7))
  const reward = loadTowerReward()
  const pendingBonus =
    reward.pendingEggBonus?.weekStart === nextWeekStart ? reward.pendingEggBonus.points : 0
  if (state.tower.played || state.tower.skipped) {
    return {
      state,
      won: state.tower.won === true,
      islandHp: state.tower.islandHp,
      weekStart,
      nextWeekStart,
      seedEarned: false,
      eggBonus: pendingBonus,
      reward,
    }
  }

  const seedEarned = won && reward.lastWinWeek !== weekStart
  if (seedEarned) {
    reward.seeds += 1
    reward.lastWinWeek = weekStart
    reward.pendingEggBonus = { weekStart: nextWeekStart, points: 10 }
    writeJSON(TOWER_REWARD_KEY, reward)
  }
  writeJSON(TOWER_WEEK_KEY, weekStart)

  const nextState: IslandState = {
    ...state,
    tower: {
      played: true,
      won,
      islandHp: won ? Math.max(1, islandHp) : 0,
      skipped: false,
    },
    egg: { ...state.egg, skippedTower: false },
  }

  return {
    state: nextState,
    won,
    islandHp: nextState.tower.islandHp,
    weekStart,
    nextWeekStart,
    seedEarned,
    eggBonus:
      reward.pendingEggBonus?.weekStart === nextWeekStart
        ? reward.pendingEggBonus.points
        : pendingBonus,
    reward,
  }
}

export function attackForSpirit(spirit: Spirit): number {
  return ATTACK_BY_RARITY[spirit.rarity]
}

export function rangeForSpirit(spirit: Spirit): number {
  return RANGE_BY_RARITY[spirit.rarity]
}

export function damageAgainst(spirit: Spirit, monster: Pick<Monster, 'category'>): number {
  const base = attackForSpirit(spirit)
  return spirit.category === monster.category ? base * 2 : base
}

export function gridDistance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function segmentLengths(): number[] {
  return PATH.slice(1).map((point, index) => {
    const previous = PATH[index]
    return Math.hypot(point.x - previous.x, point.y - previous.y)
  })
}

const SEGMENTS = segmentLengths()
export const PATH_LENGTH = SEGMENTS.reduce((sum, length) => sum + length, 0)

export function pointAtProgress(progress: number): GridPoint {
  let remaining = Math.max(0, progress)
  for (let index = 0; index < SEGMENTS.length; index += 1) {
    const length = SEGMENTS[index]
    if (remaining <= length) {
      const start = PATH[index]
      const end = PATH[index + 1]
      const ratio = length === 0 ? 0 : remaining / length
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      }
    }
    remaining -= length
  }
  return PATH[PATH.length - 1]
}

// 以 190 秒为基线摊开每波内的出怪间隔，怪物少的周也不会一眨眼结束。
export function spawnIntervalForPlan(plan: TowerPlan): number {
  const nonEmptyWaves = plan.waves.filter((wave) => wave.monsters.length > 0).length
  const spawnGaps = plan.totalMonsters - nonEmptyWaves
  if (spawnGaps <= 0) return 20
  const target = 190 - FIRST_SPAWN_SECONDS - WAVE_GAP_SECONDS * Math.max(0, nonEmptyWaves - 1)
  return Math.min(30, Math.max(SPAWN_INTERVAL_SECONDS, target / spawnGaps))
}

export function createBattle(
  plan: TowerPlan,
  defenders: BattleDefender[] = [],
  islandHp = TOWER_ISLAND_HP,
): TowerBattle {
  return {
    plan,
    waves: plan.waves.map((wave) => wave.monsters),
    defenders: [...defenders],
    monsters: [],
    waveIndex: 0,
    spawnIndex: 0,
    spawnTimer: FIRST_SPAWN_SECONDS,
    spawnInterval: spawnIntervalForPlan(plan),
    waveGap: 0,
    announcedWave: -1,
    islandHp,
    maxIslandHp: TOWER_ISLAND_HP,
    elapsed: 0,
    status: 'running',
    events: [],
    serial: 0,
  }
}

export function createDefender(spirit: Spirit, slot: GridPoint): BattleDefender {
  return {
    id: spirit.id,
    spirit,
    slot: { x: slot.x, y: slot.y },
    attack: attackForSpirit(spirit),
    range: rangeForSpirit(spirit),
    cooldown: 0,
  }
}

export function placeDefender(
  battle: TowerBattle,
  spirit: Spirit,
  slot: GridPoint,
): BattleDefender | null {
  if (battle.status !== 'running') return null
  if (battle.defenders.some((defender) => defender.id === spirit.id)) return null
  if (battle.defenders.some((defender) => gridDistance(defender.slot, slot) === 0)) return null
  const defender = createDefender(spirit, slot)
  battle.defenders.push(defender)
  return defender
}

function spawnMonster(battle: TowerBattle): BattleMonster {
  const source = battle.waves[battle.waveIndex][battle.spawnIndex]
  const point = pointAtProgress(0)
  battle.serial += 1
  const monster: BattleMonster = {
    key: `${source.id}:${battle.serial}`,
    source,
    waveIndex: battle.waveIndex,
    progress: 0,
    hp: source.hp,
    maxHp: source.maxHp,
    x: point.x,
    y: point.y,
    speed: source.speed * MONSTER_SPEED_SCALE,
  }
  battle.monsters.push(monster)
  battle.events.push({ type: 'spawn', monsterKey: monster.key, monster })
  return monster
}

function nearestTarget(
  defender: BattleDefender,
  monsters: BattleMonster[],
): BattleMonster | null {
  let target: BattleMonster | null = null
  let targetDistance = Number.POSITIVE_INFINITY
  for (const monster of monsters) {
    if (monster.hp <= 0) continue
    const cell = { x: Math.round(monster.x), y: Math.round(monster.y) }
    if (gridDistance(defender.slot, cell) > defender.range) continue
    const distance = Math.hypot(monster.x - defender.slot.x, monster.y - defender.slot.y)
    if (
      distance < targetDistance ||
      (distance === targetDistance &&
        target &&
        monster.progress > target.progress)
    ) {
      target = monster
      targetDistance = distance
    }
  }
  return target
}

function finishBattle(battle: TowerBattle, status: 'won' | 'lost'): void {
  if (battle.status !== 'running') return
  battle.status = status
  battle.events.push({ type: 'end', status })
}

export function stepBattle(battle: TowerBattle, dt: number): BattleEvent[] {
  battle.events = []
  if (battle.status !== 'running' || dt <= 0) return battle.events
  const step = Math.min(dt, 0.25)
  battle.elapsed += step

  for (const monster of battle.monsters) {
    monster.progress += monster.speed * step
    const point = pointAtProgress(monster.progress)
    monster.x = point.x
    monster.y = point.y
    if (monster.progress >= PATH_LENGTH) {
      battle.islandHp = Math.max(0, battle.islandHp - monster.hp)
      battle.events.push({
        type: 'leak',
        monsterKey: monster.key,
        damage: monster.hp,
        x: point.x,
        y: point.y,
      })
      monster.hp = 0
    }
  }
  battle.monsters = battle.monsters.filter((monster) => monster.hp > 0)

  if (battle.islandHp <= 0) {
    finishBattle(battle, 'lost')
    return battle.events
  }

  for (const defender of battle.defenders) {
    defender.cooldown -= step
    if (defender.cooldown > 0) continue
    const target = nearestTarget(defender, battle.monsters)
    if (!target) {
      defender.cooldown = 0
      continue
    }
    const damage = damageAgainst(defender.spirit, target.source)
    target.hp -= damage
    defender.cooldown = ATTACK_INTERVAL_SECONDS
    battle.events.push({
      type: 'hit',
      monsterKey: target.key,
      defenderId: defender.id,
      damage,
    })
    if (target.hp <= 0) {
      battle.events.push({ type: 'kill', monsterKey: target.key })
    }
  }
  battle.monsters = battle.monsters.filter((monster) => monster.hp > 0)

  const currentWave = battle.waves[battle.waveIndex] ?? []
  if (battle.spawnIndex < currentWave.length) {
    battle.spawnTimer -= step
    if (battle.announcedWave !== battle.waveIndex) {
      battle.announcedWave = battle.waveIndex
      battle.events.push({ type: 'wave', waveIndex: battle.waveIndex })
    }
    while (battle.spawnTimer <= 0 && battle.spawnIndex < currentWave.length) {
      spawnMonster(battle)
      battle.spawnIndex += 1
      battle.spawnTimer += battle.spawnInterval
    }
  } else {
    const hasWaveMonsters = battle.monsters.some(
      (monster) => monster.waveIndex === battle.waveIndex,
    )
    if (!hasWaveMonsters) {
      if (battle.waveIndex < battle.waves.length - 1) {
        if (battle.waveGap === 0) battle.waveGap = WAVE_GAP_SECONDS
        battle.waveGap -= step
        if (battle.waveGap <= 0) {
          battle.waveIndex += 1
          battle.spawnIndex = 0
          battle.spawnTimer = 1
          battle.waveGap = 0
          battle.events.push({ type: 'wave', waveIndex: battle.waveIndex })
          battle.announcedWave = battle.waveIndex
        }
      } else {
        finishBattle(battle, 'won')
      }
    }
  }

  return battle.events
}

export function towerPlanForState(
  state: IslandState,
  weekStart: string,
): TowerPlan {
  return buildTowerPlan(state.transactions, TOWER_ISLAND_HP, weekStart)
}

export function spiritForId(id: string): Spirit | null {
  return SPIRIT_BY_ID[id] ?? null
}