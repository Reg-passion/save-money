import { CATEGORIES } from '../data/categories'
import { WISH_THRESHOLD_CENTS, WISHLIST_COOLDOWN_HOURS } from '../data/constants'
import type { CategoryId } from '../types'
import { createBill, loadBills, type Bill } from './island'
import { isCents } from './money'
import { readJSON, writeJSON } from './storage'

const WISHES_KEY = 'wishes'
const COOLDOWN_MS = WISHLIST_COOLDOWN_HOURS * 60 * 60 * 1000
const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id))

export type WishStatus = 'pending' | 'confirmed' | 'cancelled'

export interface WishRecord {
  id: string
  amountCents: number
  category: CategoryId
  note: string
  createdAt: string
  readyAt: string
  status: WishStatus
  confirmedAt: string | null
  cancelledAt: string | null
  billId: string | null
}

export interface CreateWishInput {
  amountCents: number
  category: CategoryId
  note: string
}

export interface ConfirmWishResult {
  wish: WishRecord
  bill: Bill
}

export interface ConfirmWishOptions {
  now?: Date
}

function isWishStatus(value: unknown): value is WishStatus {
  return value === 'pending' || value === 'confirmed' || value === 'cancelled'
}

function normalizeWish(value: unknown): WishRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const wish = value as Record<string, unknown>
  if (
    typeof wish.id !== 'string' ||
    !isCents(wish.amountCents) ||
    wish.amountCents <= 0 ||
    typeof wish.category !== 'string' ||
    !CATEGORY_IDS.has(wish.category) ||
    typeof wish.note !== 'string' ||
    typeof wish.createdAt !== 'string' ||
    Number.isNaN(new Date(wish.createdAt).getTime()) ||
    !isWishStatus(wish.status)
  ) {
    return null
  }

  const createdAt = new Date(wish.createdAt)
  const readyAt =
    typeof wish.readyAt === 'string' && !Number.isNaN(new Date(wish.readyAt).getTime())
      ? new Date(wish.readyAt).toISOString()
      : new Date(createdAt.getTime() + COOLDOWN_MS).toISOString()

  return {
    id: wish.id,
    amountCents: wish.amountCents,
    category: wish.category as CategoryId,
    note: wish.note,
    createdAt: createdAt.toISOString(),
    readyAt,
    status: wish.status,
    confirmedAt: typeof wish.confirmedAt === 'string' ? wish.confirmedAt : null,
    cancelledAt: typeof wish.cancelledAt === 'string' ? wish.cancelledAt : null,
    billId: typeof wish.billId === 'string' ? wish.billId : null,
  }
}

export function loadWishes(): WishRecord[] {
  const stored = readJSON<unknown>(WISHES_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map(normalizeWish)
    .filter((wish): wish is WishRecord => wish !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function saveWishes(wishes: WishRecord[]): void {
  writeJSON(WISHES_KEY, wishes)
}

function replaceWish(wishes: WishRecord[], next: WishRecord): WishRecord[] {
  return wishes.map((wish) => (wish.id === next.id ? next : wish))
}

export function createWish(input: CreateWishInput, now = new Date()): WishRecord {
  if (!isCents(input.amountCents) || input.amountCents <= 0) {
    throw new Error('许愿金额需要大于 0')
  }

  const wish: WishRecord = {
    id: crypto.randomUUID(),
    amountCents: input.amountCents,
    category: input.category,
    note: input.note.trim(),
    createdAt: now.toISOString(),
    readyAt: new Date(now.getTime() + COOLDOWN_MS).toISOString(),
    status: 'pending',
    confirmedAt: null,
    cancelledAt: null,
    billId: null,
  }
  saveWishes([wish, ...loadWishes()])
  return wish
}

export function isWishReady(wish: WishRecord, now = new Date()): boolean {
  return now.getTime() >= new Date(wish.readyAt).getTime()
}

export function wishRemainingMs(wish: WishRecord, now = new Date()): number {
  return Math.max(0, new Date(wish.readyAt).getTime() - now.getTime())
}

export function confirmWish(
  wishId: string,
  options: ConfirmWishOptions = {},
): ConfirmWishResult {
  const now = options.now ?? new Date()
  const wishes = loadWishes()
  const wish = wishes.find((item) => item.id === wishId)
  if (!wish) throw new Error('找不到这个愿望')
  if (wish.status === 'cancelled') throw new Error('这个愿望已经取消')
  if (wish.status === 'confirmed' && wish.billId) {
    const bill = loadBills().find((item) => item.id === wish.billId)
    if (bill) return { wish, bill }
  }

  const existingBill = loadBills().find((bill) => bill.sourceWishId === wish.id)
  if (existingBill) {
    const confirmedWish: WishRecord = {
      ...wish,
      status: 'confirmed',
      confirmedAt: wish.confirmedAt ?? existingBill.time,
      billId: existingBill.id,
    }
    saveWishes(replaceWish(wishes, confirmedWish))
    return { wish: confirmedWish, bill: existingBill }
  }

  if (wish.status !== 'pending') throw new Error('这个愿望已经结束')
  if (!isWishReady(wish, now)) {
    throw new Error('冷静期还没结束')
  }

  const bill = createBill(
    {
      amountCents: wish.amountCents,
      category: wish.category,
      note: wish.note,
      time: now.toISOString(),
    },
    {
      source: 'wish',
      sourceWishId: wish.id,
      forceBoss: wish.amountCents >= WISH_THRESHOLD_CENTS,
    },
  )

  const confirmedWish: WishRecord = {
    ...wish,
    status: 'confirmed',
    confirmedAt: now.toISOString(),
    billId: bill.id,
  }
  saveWishes(replaceWish(wishes, confirmedWish))
  return { wish: confirmedWish, bill }
}

export function cancelWish(wishId: string, now = new Date()): WishRecord {
  const wishes = loadWishes()
  const wish = wishes.find((item) => item.id === wishId)
  if (!wish) throw new Error('找不到这个愿望')
  if (wish.status !== 'pending') throw new Error('只有待确认的愿望可以取消')

  const cancelled: WishRecord = {
    ...wish,
    status: 'cancelled',
    cancelledAt: now.toISOString(),
  }
  saveWishes(replaceWish(wishes, cancelled))
  return cancelled
}
