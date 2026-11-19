export type CategoryId =
  | 'takeout'
  | 'milk-tea'
  | 'night-snack'
  | 'delivery'
  | 'transport'
  | 'study'
  | 'daily'
  | 'fun'

export interface Transaction {
  id: string
  amount: number
  category: CategoryId
  note: string
  time: string
  monsterId: string
  hpCost: number
}

export interface SpiritState {
  id: string
  count: number
  evolutions: number
}

export interface IslandState {
  hp: number
  brightness: number
  trees: number
  area: number
  title: string
}

export interface StreakState {
  days: number
  lastRecordDate: string | null
}

export type EggTier = 'normal' | 'silver' | 'gold'

export interface Egg {
  tier: EggTier
  obtainedAt: string
  hatchProgress: number
  hatched: boolean
}

export interface Budget {
  monthlyBudget: number
  savingsGoal: number
}
