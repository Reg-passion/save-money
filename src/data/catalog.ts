import type { CategoryId } from '../types'
import { CATEGORIES } from './categories'

export type Rarity = 'normal' | 'rare' | 'hidden'

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: '普通',
  rare: '稀有',
  hidden: '隐藏',
}

export interface Spirit {
  id: string
  name: string
  category: CategoryId
  rarity: Rarity
  stage: 1 | 2 | 3
  primary?: boolean
  evolvesTo?: string
  hint: string
  tint: string
  accent: string
  variant: 0 | 1 | 2 | 3
}

const PALETTES: Record<CategoryId, { tint: string; accent: string }> = {
  takeout: { tint: '#F5B97A', accent: '#C97743' },
  'milk-tea': { tint: '#E3C08D', accent: '#A5794C' },
  'night-snack': { tint: '#EEA184', accent: '#B85C43' },
  delivery: { tint: '#E6C68E', accent: '#A9794F' },
  transport: { tint: '#8FD0DF', accent: '#4E93A6' },
  study: { tint: '#A9C2E8', accent: '#5C7FA8' },
  daily: { tint: '#B5DB9E', accent: '#5FA96B' },
  fun: { tint: '#D3B7EA', accent: '#8A6BB0' },
}

function makeSpirit(spirit: Omit<Spirit, 'tint' | 'accent'>): Spirit {
  const palette = PALETTES[spirit.category]
  return { ...spirit, tint: palette.tint, accent: palette.accent }
}

const CATEGORY_HINT: Record<CategoryId, string> = {
  takeout: '外卖',
  'milk-tea': '奶茶',
  'night-snack': '夜宵',
  delivery: '快递',
  transport: '交通',
  study: '学习',
  daily: '日用',
  fun: '娱乐',
}

function normalHint(category: CategoryId, first: boolean): string {
  const name = CATEGORY_HINT[category]
  return first
    ? `第一次记「${name}」时，它会先来打招呼。`
    : `记「${name}」时，它会混在账单里出现。`
}

export const CATALOG: Spirit[] = [
  makeSpirit({
    id: 'takeout-small',
    name: '外卖小怪',
    category: 'takeout',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'takeout-fighter',
    hint: normalHint('takeout', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'takeout-rice',
    name: '外卖饭团',
    category: 'takeout',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'takeout-fighter',
    hint: normalHint('takeout', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'takeout-fighter',
    name: '干饭人',
    category: 'takeout',
    rarity: 'rare',
    stage: 2,
    evolvesTo: 'takeout-boss',
    hint: '金额高一点的账单，更容易把它引出来。',
    variant: 2,
  }),
  makeSpirit({
    id: 'takeout-boss',
    name: '深夜干饭兽',
    category: 'takeout',
    rarity: 'hidden',
    stage: 3,
    hint: '夜里点黄焖鸡的人，会撞见它。',
    variant: 3,
  }),

  makeSpirit({
    id: 'milk-small',
    name: '奶茶小怪',
    category: 'milk-tea',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'milk-pearl',
    hint: normalHint('milk-tea', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'milk-bobo',
    name: '奶茶啵啵',
    category: 'milk-tea',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'milk-pearl',
    hint: normalHint('milk-tea', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'milk-pearl',
    name: '珍珠圆圆',
    category: 'milk-tea',
    rarity: 'rare',
    stage: 2,
    evolvesTo: 'milk-king',
    hint: '三分糖的杯底，藏着它的影子。',
    variant: 2,
  }),
  makeSpirit({
    id: 'milk-king',
    name: '奶茶大王',
    category: 'milk-tea',
    rarity: 'hidden',
    stage: 3,
    hint: '同一颗珍珠，相遇三次，王冠才会露出来。',
    variant: 3,
  }),

  makeSpirit({
    id: 'night-small',
    name: '夜宵小怪',
    category: 'night-snack',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'night-beast',
    hint: normalHint('night-snack', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'night-noodle',
    name: '泡面精灵',
    category: 'night-snack',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'night-beast',
    hint: normalHint('night-snack', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'night-beast',
    name: '夜宵兽',
    category: 'night-snack',
    rarity: 'rare',
    stage: 2,
    evolvesTo: 'night-king',
    hint: '金额高一点的夜宵，更容易把它引出来。',
    variant: 2,
  }),
  makeSpirit({
    id: 'night-king',
    name: '夜宵兽王',
    category: 'night-snack',
    rarity: 'hidden',
    stage: 3,
    hint: '23 点后的螺蛳粉，是它的门铃。',
    variant: 3,
  }),

  makeSpirit({
    id: 'delivery-box',
    name: '快递箱小怪',
    category: 'delivery',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'delivery-opener',
    hint: normalHint('delivery', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'delivery-tape',
    name: '胶带精',
    category: 'delivery',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'delivery-opener',
    hint: normalHint('delivery', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'delivery-opener',
    name: '拆箱怪',
    category: 'delivery',
    rarity: 'rare',
    stage: 2,
    evolvesTo: 'delivery-king',
    hint: '金额高一点的快递，更容易把它引出来。',
    variant: 2,
  }),
  makeSpirit({
    id: 'delivery-king',
    name: '剁手大王',
    category: 'delivery',
    rarity: 'hidden',
    stage: 3,
    hint: '退过货的纸箱里，藏着它的王座。',
    variant: 3,
  }),

  makeSpirit({
    id: 'traffic-bike',
    name: '小电驴',
    category: 'transport',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'traffic-runner',
    hint: normalHint('transport', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'traffic-card',
    name: '公交卡精',
    category: 'transport',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'traffic-runner',
    hint: normalHint('transport', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'traffic-guard',
    name: '末班车守护',
    category: 'transport',
    rarity: 'normal',
    stage: 3,
    hint: '赶末班车的人，偶尔会被它护送到站。',
    variant: 2,
  }),
  makeSpirit({
    id: 'traffic-runner',
    name: '赶路兽',
    category: 'transport',
    rarity: 'rare',
    stage: 2,
    hint: '金额高一点的交通账单，更容易把它引出来。',
    variant: 3,
  }),

  makeSpirit({
    id: 'study-book',
    name: '书本怪',
    category: 'study',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'study-paper',
    hint: normalHint('study', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'study-note',
    name: '笔记精',
    category: 'study',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'study-paper',
    hint: normalHint('study', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'study-cram',
    name: '考前突击兽',
    category: 'study',
    rarity: 'normal',
    stage: 3,
    hint: '考试前一晚，它比谁都精神。',
    variant: 2,
  }),
  makeSpirit({
    id: 'study-paper',
    name: '论文兽',
    category: 'study',
    rarity: 'rare',
    stage: 2,
    hint: '金额高一点的学习开销，更容易把它引出来。',
    variant: 3,
  }),

  makeSpirit({
    id: 'daily-tissue',
    name: '纸巾怪',
    category: 'daily',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'daily-hoard',
    hint: normalHint('daily', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'daily-soap',
    name: '香皂精',
    category: 'daily',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'daily-hoard',
    hint: normalHint('daily', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'daily-hoard',
    name: '囤货兽',
    category: 'daily',
    rarity: 'rare',
    stage: 2,
    evolvesTo: 'daily-treasure',
    hint: '连续记「日用」，它会把柜子塞满。',
    variant: 2,
  }),
  makeSpirit({
    id: 'daily-treasure',
    name: '宿舍百宝兽',
    category: 'daily',
    rarity: 'rare',
    stage: 3,
    hint: '宿舍里缺什么，它好像都能掏出来。',
    variant: 3,
  }),

  makeSpirit({
    id: 'fun-game',
    name: '游戏小怪',
    category: 'fun',
    rarity: 'normal',
    stage: 1,
    primary: true,
    evolvesTo: 'fun-party',
    hint: normalHint('fun', true),
    variant: 0,
  }),
  makeSpirit({
    id: 'fun-headset',
    name: '耳机精',
    category: 'fun',
    rarity: 'normal',
    stage: 1,
    evolvesTo: 'fun-party',
    hint: normalHint('fun', false),
    variant: 1,
  }),
  makeSpirit({
    id: 'fun-party',
    name: '开黑兽',
    category: 'fun',
    rarity: 'rare',
    stage: 2,
    evolvesTo: 'fun-champion',
    hint: '夜里开黑的声音，会把它叫来。',
    variant: 2,
  }),
  makeSpirit({
    id: 'fun-champion',
    name: '熬夜冠军',
    category: 'fun',
    rarity: 'rare',
    stage: 3,
    hint: '凌晨还在线的宿舍，总有它的传说。',
    variant: 3,
  }),
]

export const CATALOG_TOTAL = CATALOG.length

export const SPIRIT_BY_ID: Record<string, Spirit> = Object.fromEntries(
  CATALOG.map((spirit) => [spirit.id, spirit]),
)

export const CATEGORY_SPIRITS: Record<CategoryId, Spirit[]> = Object.fromEntries(
  CATEGORIES.map((category) => [
    category.id,
    CATALOG.filter((spirit) => spirit.category === category.id),
  ]),
) as Record<CategoryId, Spirit[]>

export const RARITY_COUNTS = CATALOG.reduce(
  (counts, spirit) => {
    counts[spirit.rarity] += 1
    return counts
  },
  { normal: 0, rare: 0, hidden: 0 } satisfies Record<Rarity, number>,
)
