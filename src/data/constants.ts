export const ISLAND_HP_MAX = 100
export const YUAN_PER_HP = 15
export const CENTS_PER_HP = YUAN_PER_HP * 100

export const DEFAULT_MONTHLY_BUDGET_CENTS = 150000
export const DEFAULT_SAVINGS_GOAL_CENTS = 30000
export const WISH_THRESHOLD_CENTS = 10000

export const WISHLIST_COOLDOWN_HOURS = 24
export const EGG_HATCH_DAYS = 3

export const EGG_BASE_RARE_RATE = {
  normal: 0.1,
  silver: 0.25,
  gold: 0.4,
} as const

export const RARE_BONUS_RATE = 0.3
export const RARE_BONUS_CAP = 0.4
export const RARE_TOTAL_CAP = 0.7
