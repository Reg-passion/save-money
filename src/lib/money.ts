export type Cents = number

export const CENTS_PER_YUAN = 100

export function yuanToCents(value: number): Cents {
  return Math.round(value * CENTS_PER_YUAN)
}

export function centsToYuan(value: Cents): number {
  return value / CENTS_PER_YUAN
}

export function parseYuanToCents(value: string | number): Cents | null {
  const text = typeof value === 'string' ? value.trim() : String(value)
  if (!text || !/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const cents = yuanToCents(Number(text))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function formatCents(value: Cents): string {
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(Math.round(value))
  const yuan = Math.floor(absolute / CENTS_PER_YUAN)
  const cents = absolute % CENTS_PER_YUAN
  if (cents === 0) return `${sign}${yuan}`
  return `${sign}${yuan}.${String(cents).padStart(2, '0').replace(/0$/, '')}`
}

export function centsToInputValue(value: Cents): string {
  return formatCents(value)
}
