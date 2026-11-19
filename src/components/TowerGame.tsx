import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react'
import { CATALOG, RARITY_LABEL, type Spirit } from '../data/catalog'
import { addDays, startOfWeek, toDateKey } from '../lib/budget'
import { formatCents } from '../lib/money'
import { loadState, saveState } from '../lib/storage'
import {
  GRID_COLUMNS,
  GRID_ROWS,
  PATH,
  SLOTS,
  TOWER_ISLAND_HP,
  attackForSpirit,
  createBattle,
  getActiveTowerWeek,
  loadTowerReward,
  placeDefender,
  rangeForSpirit,
  resolveTowerGame,
  skipTower,
  stepBattle,
  syncTowerWeek,
  towerPlanForState,
  transactionsForWeek,
  type BattleDefender,
  type BattleEvent,
  type BattleMonster,
  type TowerBattle,
  type TowerGameResult,
  type TowerPlan,
} from '../lib/tower'
import type { IslandState } from '../types'
import { SpiritSprite } from './Codex'

const CATEGORY_BADGE: Record<Spirit['category'], string> = {
  takeout: '外',
  'milk-tea': '奶',
  'night-snack': '夜',
  delivery: '递',
  transport: '行',
  study: '学',
  daily: '日',
  fun: '玩',
}

const CATEGORY_NAME: Record<Spirit['category'], string> = {
  takeout: '外卖',
  'milk-tea': '奶茶',
  'night-snack': '夜宵',
  delivery: '快递',
  transport: '交通',
  study: '学习',
  daily: '日用',
  fun: '娱乐',
}

interface MonsterEls {
  root: HTMLDivElement
  core: HTMLSpanElement
  hpFill: HTMLSpanElement
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function createMonsterEls(monster: BattleMonster): MonsterEls {
  const root = document.createElement('div')
  root.className = 'tower-monster'
  root.dataset.category = monster.source.category
  if (monster.maxHp >= 9 || monster.source.merged) root.dataset.boss = 'true'

  const core = document.createElement('span')
  core.className = 'tower-monster-core'
  core.textContent = monster.source.merged ? '大' : CATEGORY_BADGE[monster.source.category]

  const hpTrack = document.createElement('span')
  hpTrack.className = 'tower-monster-hp'
  const hpFill = document.createElement('span')
  hpTrack.append(hpFill)
  root.append(core, hpTrack)

  return { root, core, hpFill }
}

function pulseCore(core: HTMLElement): void {
  if (prefersReducedMotion()) return
  core.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
    { duration: 170, easing: 'ease-out' },
  )
}

function pulseDefender(slot: HTMLElement): void {
  if (prefersReducedMotion()) return
  slot.animate([{ filter: 'brightness(1.18)' }, { filter: 'brightness(1)' }], {
    duration: 160,
    easing: 'ease-out',
  })
}

function spawnLeakEffect(
  layer: HTMLElement | null,
  event: Extract<BattleEvent, { type: 'leak' }>,
): void {
  if (!layer || prefersReducedMotion()) return
  const label = document.createElement('span')
  label.className = 'tower-leak'
  label.textContent = `-${event.damage}`
  label.style.left = `${((event.x + 0.5) / GRID_COLUMNS) * 100}%`
  label.style.top = `${((event.y + 0.5) / GRID_ROWS) * 100}%`
  layer.append(label)
  const animation = label.animate(
    [
      { opacity: 1, transform: 'translate(-50%, -50%) scale(0.92)' },
      { opacity: 0, transform: 'translate(-50%, -130%) scale(1.06)' },
    ],
    { duration: 820, easing: 'ease-out' },
  )
  animation.onfinish = () => label.remove()
}

function formatShortDate(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return date
  return value.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function nextWeekOf(weekStart: string): string {
  const monday = new Date(`${weekStart}T00:00:00`)
  if (Number.isNaN(monday.getTime())) return weekStart
  return toDateKey(addDays(monday, 7))
}

const TOWER_STYLES = `
.tower-dialog {
  max-width: none;
  max-height: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: #20343a;
}
.tower-dialog::backdrop {
  background-color: rgb(20 45 41 / 0.58);
  backdrop-filter: blur(6px);
  overflow: hidden;
  overscroll-behavior: contain;
}
.tower-dialog:modal {
  overscroll-behavior: contain;
}
.tower-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  width: min(58rem, calc(100vw - 0.75rem));
  max-height: calc(100dvh - 0.75rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgb(255 255 255 / 0.72);
  border-radius: 1.5rem;
  padding: clamp(0.75rem, 2vw, 1.2rem);
  color: #20343a;
  background:
    radial-gradient(circle at 88% 0%, rgb(255 255 255 / 0.9), transparent 38%),
    linear-gradient(155deg, #fffdf7 0%, #f7f1e3 55%, #eaf4df 100%);
  box-shadow: 0 32px 90px -32px rgb(20 55 64 / 0.72);
}
.tower-board {
  position: relative;
  width: 100%;
  aspect-ratio: 8 / 5;
  flex: none;
  overflow: hidden;
  border: 1px solid rgb(74 120 84 / 0.28);
  border-radius: 1.1rem;
  background:
    radial-gradient(circle at 72% 26%, rgb(255 255 255 / 0.68), transparent 44%),
    linear-gradient(160deg, #eaf4df, #dcebd0);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.8);
  touch-action: manipulation;
  user-select: none;
}
.tower-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgb(62 103 72 / 0.085) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(62 103 72 / 0.085) 1px, transparent 1px);
  background-size: 12.5% 20%;
}
.tower-path {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.tower-road {
  fill: none;
  stroke: #f6ecd7;
  stroke-width: 0.72;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tower-road-edge {
  fill: none;
  stroke: #b8cba8;
  stroke-width: 0.86;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tower-road-dash {
  fill: none;
  stroke: #d7b77b;
  stroke-width: 0.08;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 0.18 0.28;
}
.tower-path-label {
  fill: #52715a;
  font-size: 0.22px;
  font-weight: 700;
  letter-spacing: 0.03px;
}
.tower-monster-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
.tower-monster {
  position: absolute;
  width: 8.6%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  will-change: left, top;
}
.tower-monster-core {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1.5px solid rgb(47 69 58 / 0.38);
  border-radius: 46% 54% 58% 42% / 50% 43% 57% 50%;
  background: var(--monster-tint, #f5b97a);
  color: rgb(42 54 45 / 0.72);
  font-size: clamp(0.52rem, 1.5vw, 0.78rem);
  font-weight: 800;
  line-height: 1;
  box-shadow:
    0 3px 0 rgb(42 61 52 / 0.16),
    inset 0 -3px 0 rgb(0 0 0 / 0.07);
}
.tower-monster[data-category="takeout"] { --monster-tint: #f5b97a; }
.tower-monster[data-category="milk-tea"] { --monster-tint: #e3c08d; }
.tower-monster[data-category="night-snack"] { --monster-tint: #eea184; }
.tower-monster[data-category="delivery"] { --monster-tint: #e6c68e; }
.tower-monster[data-category="transport"] { --monster-tint: #8fd0df; }
.tower-monster[data-category="study"] { --monster-tint: #a9c2e8; }
.tower-monster[data-category="daily"] { --monster-tint: #b5db9e; }
.tower-monster[data-category="fun"] { --monster-tint: #d3b7ea; }
.tower-monster[data-boss="true"] .tower-monster-core {
  border-width: 2px;
  border-color: #8e5b38;
  box-shadow:
    0 3px 0 rgb(42 61 52 / 0.2),
    0 0 0 3px rgb(255 250 231 / 0.72);
}
.tower-monster-hp {
  display: block;
  width: 82%;
  height: 3px;
  margin-top: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(31 57 47 / 0.22);
}
.tower-monster-hp > span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: #e56b5d;
}
.tower-slot {
  position: absolute;
  z-index: 4;
  width: 11.5%;
  min-width: 2.25rem;
  min-height: 2.25rem;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 2px;
  border: 1.5px dashed rgb(74 107 72 / 0.48);
  border-radius: 0.72rem;
  background: rgb(255 252 243 / 0.58);
  color: #5d7c5f;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  touch-action: manipulation;
}
.tower-slot[data-filled="true"] {
  border-style: solid;
  border-color: rgb(255 255 255 / 0.9);
  background: rgb(255 255 255 / 0.72);
  color: #315145;
  box-shadow: 0 4px 12px -5px rgb(27 58 49 / 0.42);
}
.tower-slot[data-selected="true"] {
  border-style: solid;
  border-color: #d69a3b;
  outline: 2px solid #d69a3b;
  outline-offset: 2px;
  background: #fff4d8;
}
.tower-slot:focus-visible {
  outline: 2px solid #315145;
  outline-offset: 2px;
}
.tower-slot:disabled {
  opacity: 1;
}
.tower-slot-sprite {
  display: block;
  width: 82%;
  aspect-ratio: 1;
}
.tower-slot-name {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(0.42rem, 1.2vw, 0.58rem);
  font-weight: 600;
}
.tower-slot-plus {
  font-size: clamp(0.8rem, 2.2vw, 1.05rem);
  line-height: 1;
}
.tower-slot-label {
  font-size: clamp(0.38rem, 1.1vw, 0.5rem);
  font-weight: 500;
  opacity: 0.68;
}
.tower-wave-banner {
  position: absolute;
  left: 50%;
  top: 7%;
  z-index: 6;
  transform: translate(-50%, -5px);
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: rgb(32 52 58 / 0.88);
  color: #fff8e7;
  font-size: clamp(0.62rem, 1.6vw, 0.74rem);
  font-weight: 600;
  letter-spacing: 0.03em;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}
.tower-wave-banner.is-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}
.tower-pause-badge {
  position: absolute;
  right: 3%;
  top: 7%;
  z-index: 6;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: rgb(255 250 231 / 0.92);
  color: #7b5a2e;
  font-size: 0.68rem;
  font-weight: 700;
  pointer-events: none;
}
.tower-leak {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, -50%);
  color: #c3483c;
  font-size: clamp(0.65rem, 1.8vw, 0.85rem);
  font-weight: 800;
  pointer-events: none;
  text-shadow: 0 1px 0 #fff8e7;
}
.tower-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem;
  border: 1px solid rgb(255 255 255 / 0.7);
  border-radius: 1rem;
  background: rgb(255 252 243 / 0.72);
}
.tower-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  max-height: 14rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tower-picker-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.45rem;
  border: 1px solid rgb(74 107 72 / 0.18);
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 0.68);
  color: #315145;
  text-align: left;
  touch-action: manipulation;
}
.tower-picker-card:hover {
  border-color: rgb(74 107 72 / 0.4);
  background: #fff;
}
.tower-picker-card:focus-visible {
  outline: 2px solid #315145;
  outline-offset: 2px;
}
.tower-result {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.9rem;
  background: rgb(19 42 37 / 0.58);
  backdrop-filter: blur(5px);
}
.tower-result-card {
  width: min(27rem, 100%);
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid rgb(255 255 255 / 0.75);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at 92% 0%, rgb(255 255 255 / 0.9), transparent 40%),
    linear-gradient(150deg, #fffdf7, #f3ead7);
  box-shadow: 0 24px 70px -25px rgb(14 38 32 / 0.7);
}
@media (min-width: 640px) {
  .tower-picker-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (min-width: 900px) {
  .tower-picker-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: no-preference) {
  .tower-wave-banner {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .tower-road-dash {
    animation: tower-road-flow 1.2s linear infinite;
  }
  .tower-result-card {
    animation: tower-result-pop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
}
@keyframes tower-road-flow {
  to { stroke-dashoffset: -0.46; }
}
@keyframes tower-result-pop {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`

export default function TowerGame() {
  const [state, setState] = useState<IslandState>(() => loadState())
  const [gameOpen, setGameOpen] = useState(false)
  const [battlePlan, setBattlePlan] = useState<TowerPlan | null>(null)
  const [placed, setPlaced] = useState<BattleDefender[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [result, setResult] = useState<TowerGameResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [, setClockTick] = useState(0)

  const entryTitleId = useId()
  const gameTitleId = useId()
  const gameDescId = useId()
  const resultTitleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const monsterLayerRef = useRef<HTMLDivElement>(null)
  const waveBannerRef = useRef<HTMLDivElement>(null)
  const hpTextRef = useRef<HTMLSpanElement>(null)
  const hpFillRef = useRef<HTMLDivElement>(null)
  const hpBarRef = useRef<HTMLDivElement>(null)
  const waveTextRef = useRef<HTMLSpanElement>(null)
  const nextTextRef = useRef<HTMLSpanElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const resultButtonRef = useRef<HTMLButtonElement>(null)

  const battleRef = useRef<TowerBattle | null>(null)
  const planRef = useRef<TowerPlan | null>(null)
  const weekRef = useRef('')
  const gameOpenRef = useRef(false)
  const pausedRef = useRef(false)
  const speedRef = useRef<1 | 2>(1)
  const finishedRef = useRef(false)
  const signatureRef = useRef('')
  const lastFrameRef = useRef(0)
  const waveBannerTimerRef = useRef<number | null>(null)
  const monsterElsRef = useRef(new Map<string, MonsterEls>())

  const entryWeek = getActiveTowerWeek(state)
  const entryPlan = entryWeek ? towerPlanForState(state, entryWeek) : null
  const entryTransactions = entryWeek
    ? transactionsForWeek(state.transactions, entryWeek)
    : []
  const entrySpentCents = entryTransactions.reduce(
    (sum, transaction) => sum + transaction.amountCents,
    0,
  )
  const entryNextWeek = entryWeek ? nextWeekOf(entryWeek) : ''
  const reward = entryWeek ? loadTowerReward() : null
  const ownedSpirits = CATALOG.filter((spirit) => Boolean(state.spirits[spirit.id]))
  const placedIds = new Set(placed.map((defender) => defender.id))
  const availableSpirits = ownedSpirits.filter((spirit) => !placedIds.has(spirit.id))

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    gameOpenRef.current = gameOpen
  }, [gameOpen])

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = useCallback(() => {
    if (gameOpenRef.current) return
    try {
      const latest = loadState()
      const synced = syncTowerWeek(latest)
      if (synced !== latest) saveState(synced)
      const signature = JSON.stringify(synced)
      if (signature === signatureRef.current) return
      signatureRef.current = signature
      setState(synced)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '读取塔防状态失败，请刷新后重试。',
      )
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- localStorage 是外部系统，挂载时同步塔防周状态
    refresh()
    const timer = window.setInterval(refresh, 2500)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refresh])

  useEffect(() => {
    if (result) resultButtonRef.current?.focus()
  }, [result])

  const showWaveBanner = useCallback((text: string) => {
    const banner = waveBannerRef.current
    if (!banner) return
    banner.textContent = text
    banner.classList.add('is-visible')
    if (waveBannerTimerRef.current !== null) {
      window.clearTimeout(waveBannerTimerRef.current)
    }
    waveBannerTimerRef.current = window.setTimeout(() => {
      banner.classList.remove('is-visible')
      waveBannerTimerRef.current = null
    }, 2200)
  }, [])

  const syncBattleDom = useCallback((battle: TowerBattle) => {
    const layer = monsterLayerRef.current
    if (!layer) return
    const activeKeys = new Set<string>()
    for (const monster of battle.monsters) {
      activeKeys.add(monster.key)
      let els = monsterElsRef.current.get(monster.key)
      if (!els) {
        els = createMonsterEls(monster)
        layer.append(els.root)
        monsterElsRef.current.set(monster.key, els)
      }
      els.root.style.left = `${((monster.x + 0.5) / GRID_COLUMNS) * 100}%`
      els.root.style.top = `${((monster.y + 0.5) / GRID_ROWS) * 100}%`
      els.root.style.zIndex = String(10 + Math.round(monster.y * 2))
      els.hpFill.style.width = `${Math.max(0, (monster.hp / monster.maxHp) * 100)}%`
    }
    for (const [key, els] of monsterElsRef.current) {
      if (activeKeys.has(key)) continue
      els.root.remove()
      monsterElsRef.current.delete(key)
    }
  }, [])

  const updateHud = useCallback((battle: TowerBattle) => {
    const hp = Math.max(0, battle.islandHp)
    if (hpTextRef.current) hpTextRef.current.textContent = String(hp)
    if (hpFillRef.current) {
      hpFillRef.current.style.width = `${(hp / battle.maxIslandHp) * 100}%`
    }
    if (hpBarRef.current) hpBarRef.current.setAttribute('aria-valuenow', String(hp))
    if (waveTextRef.current) {
      const current = Math.min(battle.waveIndex + 1, battle.waves.length)
      waveTextRef.current.textContent = `第 ${current} / ${battle.waves.length} 波`
    }
    if (nextTextRef.current) {
      const wave = battle.waves[battle.waveIndex] ?? []
      if (battle.waveGap > 0) {
        nextTextRef.current.textContent = `下一波 ${Math.ceil(battle.waveGap)} 秒`
      } else if (battle.spawnIndex < wave.length) {
        nextTextRef.current.textContent = `下一只 ${Math.ceil(Math.max(0, battle.spawnTimer))} 秒`
      } else if (battle.monsters.length > 0) {
        nextTextRef.current.textContent = '场上清理中'
      } else {
        nextTextRef.current.textContent = '准备下一波'
      }
    }
  }, [])

  const handleBattleEvents = useCallback(
    (events: BattleEvent[]) => {
      for (const event of events) {
        if (event.type === 'wave') {
          const label = planRef.current?.waves[event.waveIndex]?.label ?? ''
          showWaveBanner(`第 ${event.waveIndex + 1} 波 · ${label}`)
          if (liveRef.current) {
            liveRef.current.textContent = `第 ${event.waveIndex + 1} 波开始。`
          }
        } else if (event.type === 'hit') {
          const els = monsterElsRef.current.get(event.monsterKey)
          if (els) pulseCore(els.core)
          const defender = boardRef.current?.querySelector<HTMLElement>(
            `[data-tower-defender="${event.defenderId}"]`,
          )
          if (defender) pulseDefender(defender)
        } else if (event.type === 'leak') {
          spawnLeakEffect(monsterLayerRef.current, event)
          if (liveRef.current) {
            liveRef.current.textContent = `怪物走到岛中心，岛血 -${event.damage}。`
          }
        } else if (event.type === 'end') {
          if (liveRef.current) {
            liveRef.current.textContent = event.status === 'won' ? '战斗胜利。' : '战斗失败。'
          }
        }
      }
    },
    [showWaveBanner],
  )

  const finishBattle = useCallback(
    (battle: TowerBattle) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const won = battle.status === 'won'
      pausedRef.current = true
      setPaused(true)
      setSelectedSlot(null)
      updateHud(battle)

      let outcome: TowerGameResult
      try {
        const synced = syncTowerWeek(loadState())
        outcome = resolveTowerGame(synced, won, battle.islandHp)
        saveState(outcome.state)
        signatureRef.current = JSON.stringify(outcome.state)
        setState(outcome.state)
        setMessage(null)
      } catch (error) {
        outcome = {
          state: loadState(),
          won,
          islandHp: battle.islandHp,
          weekStart: weekRef.current || toDateKey(startOfWeek(new Date())),
          nextWeekStart: nextWeekOf(
            weekRef.current || toDateKey(startOfWeek(new Date())),
          ),
          seedEarned: false,
          eggBonus: 0,
          reward: loadTowerReward(),
        }
        setMessage(
          error instanceof Error
            ? `战斗结果保存失败：${error.message}`
            : '战斗结果保存失败，请检查浏览器存储空间。',
        )
      }
      setResult(outcome)
    },
    [updateHud],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!gameOpen) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) dialog.showModal()

    let raf = 0
    let stopped = false
    const tick = (time: number) => {
      if (stopped) return
      const battle = battleRef.current
      if (!battle || battle.status !== 'running') return
      if (!lastFrameRef.current) {
        lastFrameRef.current = time
        raf = requestAnimationFrame(tick)
        return
      }
      const delta = Math.min(0.2, Math.max(0, (time - lastFrameRef.current) / 1000))
      lastFrameRef.current = time
      if (!pausedRef.current) {
        const events = stepBattle(battle, delta * speedRef.current)
        handleBattleEvents(events)
        syncBattleDom(battle)
        updateHud(battle)
        if (battle.status !== 'running') {
          finishBattle(battle)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pausedRef.current = true
        setPaused(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (dialog.open) dialog.close()
    }
  }, [gameOpen, finishBattle, handleBattleEvents, syncBattleDom, updateHud])

  const closeGame = useCallback(() => {
    setGameOpen(false)
    setBattlePlan(null)
    setSelectedSlot(null)
    setPlaced([])
    setResult(null)
    battleRef.current = null
    planRef.current = null
    weekRef.current = ''
    finishedRef.current = false
    lastFrameRef.current = 0
    if (waveBannerTimerRef.current !== null) {
      window.clearTimeout(waveBannerTimerRef.current)
      waveBannerTimerRef.current = null
    }
    for (const els of monsterElsRef.current.values()) els.root.remove()
    monsterElsRef.current.clear()
    monsterLayerRef.current?.replaceChildren()
    if (liveRef.current) liveRef.current.textContent = ''
  }, [])

  function handleStart() {
    let latest: IslandState
    try {
      latest = syncTowerWeek(loadState())
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '读取塔防状态失败，请刷新后重试。',
      )
      return
    }
    const week = getActiveTowerWeek(latest)
    if (!week) {
      setState(latest)
      setMessage('本周塔防入口已经关闭，下周一孵出新蛋后再来。')
      return
    }
    const plan = towerPlanForState(latest, week)
    if (plan.totalMonsters <= 0) {
      setState(latest)
      setMessage('本周没有怪物，岛很安全。')
      return
    }
    try {
      saveState(latest)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '保存塔防状态失败，请稍后重试。',
      )
      return
    }
    signatureRef.current = JSON.stringify(latest)
    setState(latest)
    setBattlePlan(plan)
    planRef.current = plan
    weekRef.current = week
    battleRef.current = createBattle(plan)
    finishedRef.current = false
    lastFrameRef.current = 0
    pausedRef.current = false
    speedRef.current = 1
    setPaused(false)
    setSpeed(1)
    setPlaced([])
    setSelectedSlot(null)
    setResult(null)
    setMessage(null)
    for (const els of monsterElsRef.current.values()) els.root.remove()
    monsterElsRef.current.clear()
    setGameOpen(true)
  }

  function handleSkip() {
    try {
      const latest = loadState()
      if (!getActiveTowerWeek(latest)) {
        setState(latest)
        setMessage('本周塔防入口已经关闭，下周一孵出新蛋后再来。')
        return
      }
      const next = skipTower(latest)
      saveState(next)
      signatureRef.current = JSON.stringify(next)
      setState(next)
      setMessage(null)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '跳过失败，请检查浏览器存储空间。',
      )
    }
  }

  function handleChooseSlot(index: number) {
    if (result) return
    setSelectedSlot((current) => (current === index ? null : index))
  }

  function handlePlaceSpirit(spirit: Spirit) {
    const battle = battleRef.current
    if (!battle || selectedSlot === null || result) return
    const defender = placeDefender(battle, spirit, SLOTS[selectedSlot])
    if (!defender) {
      setMessage('这只精灵或这个格子已经用过了。')
      return
    }
    setPlaced([...battle.defenders])
    setSelectedSlot(null)
    setMessage(null)
    if (liveRef.current) {
      liveRef.current.textContent = `${spirit.name} 已放到第 ${selectedSlot + 1} 格。`
    }
  }

  function togglePause() {
    if (result) return
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
  }

  function changeSpeed(next: 1 | 2) {
    speedRef.current = next
    setSpeed(next)
  }

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    if (result) {
      closeGame()
      return
    }
    pausedRef.current = true
    setPaused(true)
    if (liveRef.current) liveRef.current.textContent = '战斗已暂停。'
  }

  if (!entryWeek && !gameOpen) return null

  return (
    <>
      <style>{TOWER_STYLES}</style>

      {entryWeek && entryPlan && (
        <section
          className="glass-panel pointer-events-auto p-4"
          aria-labelledby={entryTitleId}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold tracking-[0.24em] text-ink/30">
                WEEKLY DEFENSE
              </p>
              <h2 id={entryTitleId} className="mt-0.5 text-base font-bold text-ink">
                本周怪物来了
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-ink/55">
                {entryPlan.totalMonsters > 0
                  ? `本周记了 ${formatCents(entrySpentCents)} 元，来了 ${entryPlan.totalMonsters} 只怪物，总血量 ${entryPlan.totalHp}。`
                  : '本周没有怪物，岛很安全'}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-[#D6C69B] bg-[#FFF8E7] px-2.5 py-1 text-[10px] font-semibold text-[#8A6A3C]">
              {state.tower.skipped
                ? '已跳过'
                : state.tower.played
                  ? '已结束'
                  : '待守岛'}
            </span>
          </div>

          {entryPlan.totalMonsters > 0 && !state.tower.played && !state.tower.skipped && (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {entryPlan.waves.map((wave) => (
                <div
                  key={wave.index}
                  className="rounded-xl border border-white/70 bg-white/45 px-2.5 py-2"
                >
                  <p className="text-[9px] font-semibold text-ink/40">{wave.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-ink">
                    {wave.monsters.length} 只 · {wave.totalHp} 血
                  </p>
                </div>
              ))}
            </div>
          )}

          {message && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-[#E4BE93] bg-[#FBF0E0] px-3 py-2 text-[11px] leading-relaxed text-[#8A5A2B]"
            >
              {message}
            </p>
          )}

          {state.tower.skipped ? (
            <div className="mt-3 rounded-xl border border-[#D8C9AA] bg-[#FFF8E7]/80 px-3 py-3">
              <p className="text-xs font-semibold text-[#7B5A2E]">本周塔防已跳过</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink/55">
                没有种子，也没有下周蛋 +10 分。账单、日报、周报和图鉴都不受影响，
                下周一新蛋从 0 分开始。
              </p>
            </div>
          ) : state.tower.played ? (
            <div className="mt-3 rounded-xl border border-white/70 bg-white/48 px-3 py-3">
              <p className="text-xs font-semibold text-ink">
                {state.tower.won ? '守住了，本周结算完成' : '岛被攻破，本周结算完成'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink/55">
                {state.tower.won
                  ? `剩余岛血 ${state.tower.islandHp}/100。种子 +1（现有 ${reward?.seeds ?? 0} 颗），下周蛋 +10 分起步。`
                  : '本次没有奖励；图鉴、蛋、账单都没有被清空。下周一孵出新蛋后可以再来。'}
              </p>
              <p className="mt-1 text-[10px] text-ink/40">
                下一枚蛋：{formatShortDate(entryNextWeek)} 起
              </p>
            </div>
          ) : entryPlan.totalMonsters <= 0 ? (
            <button
              type="button"
              onClick={handleSkip}
              className="mt-3 min-h-11 w-full rounded-xl border border-[#D6C69B] bg-[#FFF8E7] px-3 text-xs font-semibold text-[#7B5A2E] transition-colors hover:bg-[#FBEDC0]"
            >
              跳过塔防，直接开始下周
            </button>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleStart}
                  className="min-h-11 flex-1 rounded-xl bg-[#315B4E] px-4 text-xs font-semibold text-[#FFFDF7] transition-colors hover:bg-[#274A3F]"
                >
                  打塔防
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="min-h-11 flex-1 rounded-xl border border-[#C9B98F] bg-white/45 px-4 text-xs font-semibold text-ink/65 transition-colors hover:bg-white/70"
                >
                  跳过塔防，直接开始下周
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-ink/40">
                不强制打，下周一自动过期。一局约 3-5 分钟，每 15 元约 1 点血，每波最多 10 只，超出会合成大怪。
              </p>
            </>
          )}
        </section>
      )}

      <dialog
        ref={dialogRef}
        className="tower-dialog"
        aria-labelledby={gameTitleId}
        aria-describedby={gameDescId}
        onCancel={handleDialogCancel}
        onClose={() => {
          if (gameOpenRef.current) closeGame()
        }}
      >
        <div className="tower-shell">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold tracking-[0.26em] text-ink/35">
                TOWER DEFENSE
              </p>
              <h2 id={gameTitleId} className="mt-0.5 text-lg font-bold text-ink">
                守住钱钱岛
              </h2>
              <p id={gameDescId} className="mt-0.5 text-[10px] leading-relaxed text-ink/50">
                点放置格，再选一只精灵；精灵会自动攻击。每只精灵一局只能放一次。
              </p>
            </div>
            <div className="w-full max-w-[17rem] rounded-xl border border-white/70 bg-white/55 px-3 py-2 sm:w-auto">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold text-ink/45">岛血</span>
                <span className="text-sm font-bold tabular-nums text-ink">
                  <span ref={hpTextRef}>{TOWER_ISLAND_HP}</span>
                  <span className="text-[10px] font-medium text-ink/40"> / 100</span>
                </span>
              </div>
              <div
                ref={hpBarRef}
                role="progressbar"
                aria-label="岛血量"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={TOWER_ISLAND_HP}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E4D9C4]"
              >
                <div ref={hpFillRef} className="h-full w-full rounded-full bg-[#6E9F6A]" />
              </div>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <span
              ref={waveTextRef}
              className="rounded-full bg-[#315B4E] px-2.5 py-1 text-[10px] font-semibold text-[#FFFDF7] tabular-nums"
            >
              第 1 / {battlePlan?.waves.length ?? 3} 波
            </span>
            <span
              ref={nextTextRef}
              aria-hidden="true"
              className="rounded-full bg-white/55 px-2.5 py-1 text-[10px] text-ink/55 tabular-nums"
            >
              准备开始
            </span>
            <span className="rounded-full bg-white/45 px-2.5 py-1 text-[10px] text-ink/45">
              已放 {placed.length} / {SLOTS.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePause}
                aria-pressed={paused}
                className="min-h-9 rounded-lg border border-white/70 bg-white/55 px-2.5 text-[10px] font-semibold text-ink/65 transition-colors hover:bg-white"
              >
                {paused ? '继续' : '暂停'}
              </button>
              <div
                role="group"
                aria-label="战斗倍速"
                className="flex items-center gap-0.5 rounded-lg border border-white/70 bg-white/45 p-0.5"
              >
                {([1, 2] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeSpeed(value)}
                    aria-pressed={speed === value}
                    className={`min-h-8 rounded-md px-2 text-[10px] font-semibold transition-colors ${
                      speed === value
                        ? 'bg-[#315B4E] text-[#FFFDF7]'
                        : 'text-ink/50 hover:bg-white/70'
                    }`}
                  >
                    {value}×
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={closeGame}
                className="min-h-9 rounded-lg border border-white/70 bg-white/55 px-2.5 text-[10px] font-semibold text-ink/65 transition-colors hover:bg-white"
              >
                退出
              </button>
            </div>
          </div>

          {message && (
            <p
              role="alert"
              className="rounded-xl border border-[#E4BE93] bg-[#FBF0E0] px-3 py-2 text-[11px] leading-relaxed text-[#8A5A2B]"
            >
              {message}
            </p>
          )}

          <div ref={boardRef} className="tower-board" aria-label="塔防地图，8 列 5 行">
            <div className="tower-grid" aria-hidden="true" />
            <svg
              className="tower-path"
              viewBox={`0 0 ${GRID_COLUMNS} ${GRID_ROWS}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                className="tower-road-edge"
                points={PATH.map((point) => `${point.x + 0.5},${point.y + 0.5}`).join(' ')}
              />
              <polyline
                className="tower-road"
                points={PATH.map((point) => `${point.x + 0.5},${point.y + 0.5}`).join(' ')}
              />
              <polyline
                className="tower-road-dash"
                points={PATH.map((point) => `${point.x + 0.5},${point.y + 0.5}`).join(' ')}
              />
              <circle
                cx={PATH[0].x + 0.5}
                cy={PATH[0].y + 0.5}
                r="0.34"
                fill="#F6ECD7"
                stroke="#B8CBA8"
                strokeWidth="0.06"
              />
              <circle
                cx={PATH[PATH.length - 1].x + 0.5}
                cy={PATH[PATH.length - 1].y + 0.5}
                r="0.46"
                fill="#DDEACF"
                stroke="#7F9F72"
                strokeWidth="0.08"
              />
              <text
                className="tower-path-label"
                x={PATH[0].x + 0.5}
                y={PATH[0].y - 0.12}
                textAnchor="middle"
              >
                岛外
              </text>
              <text
                className="tower-path-label"
                x={PATH[PATH.length - 1].x + 0.5}
                y={PATH[PATH.length - 1].y + 0.98}
                textAnchor="middle"
              >
                岛中心
              </text>
            </svg>
            <div ref={monsterLayerRef} className="tower-monster-layer" aria-hidden="true" />
            <div ref={waveBannerRef} className="tower-wave-banner" aria-hidden="true" />
            {paused && !result && <span className="tower-pause-badge">已暂停</span>}

            {SLOTS.map((slot, index) => {
              const defender = placed.find(
                (item) => item.slot.x === slot.x && item.slot.y === slot.y,
              )
              const selected = selectedSlot === index
              return (
                <button
                  key={`${slot.x}-${slot.y}`}
                  type="button"
                  onClick={() => handleChooseSlot(index)}
                  disabled={Boolean(defender) || Boolean(result)}
                  data-filled={defender ? 'true' : 'false'}
                  data-selected={selected ? 'true' : 'false'}
                  data-tower-defender={defender?.id}
                  aria-label={
                    defender
                      ? `第 ${index + 1} 格，${defender.spirit.name}，攻击 ${defender.attack}，范围 ${defender.range}`
                      : `第 ${index + 1} 格，空放置格，点按选择精灵`
                  }
                  className="tower-slot"
                  style={{
                    left: `${((slot.x + 0.5) / GRID_COLUMNS) * 100}%`,
                    top: `${((slot.y + 0.5) / GRID_ROWS) * 100}%`,
                  }}
                >
                  {defender ? (
                    <>
                      <span className="tower-slot-sprite">
                        <SpiritSprite spirit={defender.spirit} className="h-full w-full" />
                      </span>
                      <span className="tower-slot-name">{defender.spirit.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="tower-slot-plus" aria-hidden="true">
                        +
                      </span>
                      <span className="tower-slot-label" aria-hidden="true">
                        放置格
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          <p ref={liveRef} role="status" aria-live="polite" className="sr-only" />

          {!result && selectedSlot !== null ? (
            <div className="tower-picker">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-ink">
                  给第 {selectedSlot + 1} 格选一只精灵
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="min-h-8 rounded-md px-2 text-[10px] font-medium text-ink/50 hover:bg-white/70"
                >
                  取消
                </button>
              </div>
              {availableSpirits.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/80 bg-white/40 px-3 py-4 text-center text-[11px] text-ink/45">
                  已经放了 6 只，这一局的精灵都用完了。
                </p>
              ) : (
                <div className="tower-picker-grid">
                  {availableSpirits.map((spirit) => {
                    const attack = attackForSpirit(spirit)
                    const range = rangeForSpirit(spirit)
                    return (
                      <button
                        key={spirit.id}
                        type="button"
                        onClick={() => handlePlaceSpirit(spirit)}
                        className="tower-picker-card"
                      >
                        <span className="h-9 w-9 shrink-0">
                          <SpiritSprite spirit={spirit} className="h-full w-full" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-semibold">
                            {spirit.name}
                          </span>
                          <span className="block text-[9px] leading-tight opacity-60">
                            攻 {attack} · 程 {range} · {CATEGORY_NAME[spirit.category]}
                          </span>
                          <span className="block text-[9px] leading-tight opacity-45">
                            {RARITY_LABEL[spirit.rarity]} · 同类 ×2
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            !result && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/65 bg-white/38 px-3 py-2">
                <p className="text-[10px] leading-relaxed text-ink/50">
                  点地图两旁的放置格，再选精灵。精灵会自动攻击，同类打同类伤害翻倍。
                </p>
                <span className="rounded-full bg-white/55 px-2 py-0.5 text-[9px] font-semibold text-ink/45">
                  已收集 {ownedSpirits.length} 只可选
                </span>
              </div>
            )
          )}

          <p className="text-[9px] leading-relaxed text-ink/35">
            岛中心每进入一只怪，扣它剩余的血量。打完 3 波且岛血大于 0 即胜利。
          </p>

          {result && (
            <div className="tower-result">
              <section
                role="alert"
                aria-labelledby={resultTitleId}
                className="tower-result-card"
              >
                <p className="text-[9px] font-semibold tracking-[0.24em] text-ink/35">
                  BATTLE REPORT
                </p>
                <h3 id={resultTitleId} className="mt-1 text-lg font-bold text-ink">
                  {result.won ? '岛守住了' : '岛被攻破了'}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/55">
                  {result.won
                    ? `剩余岛血 ${result.islandHp}/100。`
                    : '怪物走进了岛中心，本次没有奖励。'}
                </p>
                <div className="mt-3 rounded-xl border border-white/75 bg-white/55 px-3 py-2.5">
                  {result.won ? (
                    <>
                      <p className="text-xs font-semibold text-[#4F7250]">
                        种子 +1（现有 {result.reward.seeds} 颗）
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink/55">
                        下周蛋 +{result.eggBonus || 10} 分起步，{formatShortDate(result.nextWeekStart)} 起算。
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-ink/55">
                      图鉴、蛋、账单都还在。下周一孵出新蛋后可以再来。
                    </p>
                  )}
                </div>
                {message && (
                  <p className="mt-2 rounded-lg border border-[#E4BE93] bg-[#FBF0E0] px-2.5 py-2 text-[10px] leading-relaxed text-[#8A5A2B]">
                    {message}
                  </p>
                )}
                <button
                  ref={resultButtonRef}
                  type="button"
                  onClick={closeGame}
                  className="mt-3 min-h-11 w-full rounded-xl bg-[#315B4E] px-4 text-xs font-semibold text-[#FFFDF7] transition-colors hover:bg-[#274A3F]"
                >
                  收下结果
                </button>
              </section>
            </div>
          )}
        </div>
      </dialog>
    </>
  )
}