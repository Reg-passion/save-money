export type CategoryId =
  | 'takeout'
  | 'milk-tea'
  | 'night-snack'
  | 'delivery'
  | 'transport'
  | 'study'
  | 'daily'
  | 'fun'

export type EggTier = 'normal' | 'silver' | 'gold'

export type BillSource = 'manual' | 'wish' | 'import'

export type SummonOutcome = 'spirit' | 'energy'

export interface Transaction {
  id: string
  amountCents: number
  category: CategoryId
  note: string
  time: string
  date: string
  monsterHp: number
  monsterId: string
  spiritId: string | null
  summonOutcome: SummonOutcome | null
  source: BillSource
  sourceWishId?: string
}

export interface SpiritRecord {
  count: number
  evolved: boolean
  firstSeenAt: string
}

export interface EggState {
  cycleStart: string
  score: number
  dailyScores: Record<string, number>
  tier: EggTier | null
  hatched: boolean
  hatchedSpiritId: string | null
  skippedTower: boolean
}

export interface Budgets {
  daily: number
  weekly: number
}

export interface TowerState {
  played: boolean
  won: boolean | null
  islandHp: number
  skipped: boolean
}

export interface FarmPlot {
  seed: string | null
  days: number
}

export interface IslandState {
  version: 2
  seededAt: string | null
  transactions: Transaction[]
  spirits: Record<string, SpiritRecord>
  egg: EggState
  budgets: Budgets
  tower: TowerState
  farm: { plots: FarmPlot[] }
  settings: { wishPoolEnabled: boolean }
}