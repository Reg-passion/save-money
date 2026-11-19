# 钱钱岛 v2 代码实现指南

> 收录说明（2026-11-19）：本文件按原始指南收录；与当前仓库的差异（整数分、无记账日 +0、多键存储兼容、3D 岛保留等）见 [`README.md`](../README.md) 的「v2 实施指南落地说明」，实施时以主规格为准。
> 规格依据：daily-egg-tower-defense-spec-v2.md
> 原则：基础功能先做，塔防最后做。记账 → 分类统计 → 日报 → 周报 → 蛋 → 塔防。
> 技术栈：Vite + React + TypeScript + Tailwind CSS，纯前端静态，localStorage，部署 GitHub Pages / Qoder Sites。

## 0. 总架构（一句话）

**逻辑层是纯函数，UI 层只负责显示，塔防是独立的小引擎。**

不要把算钱、算蛋、算怪物的逻辑写在组件里。组件只做三件事：读 state、调函数、显示结果。这样 Qoder 改 UI 不会改错钱，改数值只改一个文件。

```
UI (React 组件)
  ↓ 调用
逻辑层 (src/lib/*.ts, 纯函数, 可单元测试)
  ↓ 读写
存储层 (src/lib/storage.ts, localStorage, 键名 money-island:v1)
```

## 1. 技术栈与文件结构

```bash
npm create vite@latest save-money -- --template react-ts
npm install
# 不需要后端库，不需要 Three.js（v2 先做 2.5D SVG 岛，3D 是可选项）
# 动画只用 CSS + requestAnimationFrame，不要引重型动画库
```

```
save-money/
├── src/
│   ├── App.tsx                  # 入口：三个 Tab + 底部 Dock
│   ├── main.tsx
│   ├── index.css                # Tailwind + 玻璃卡片 + 动画
│   ├── types.ts                 # 全部类型定义（先写这个）
│   ├── data/
│   │   ├── catalog.ts           # 32 只精灵目录
│   │   ├── seed.ts              # 种子账单生成（约 120 笔）
│   │   └── templates.ts         # 一键记账模板：蜜雪 18 / 外卖 23 / 公交 2
│   ├── lib/
│   │   ├── storage.ts           # loadState / saveState，localStorage
│   │   ├── budget.ts            # 日预算 / 周预算计算
│   │   ├── ledger.ts            # 记账、改、删、筛选、分类统计
│   │   ├── egg.ts               # 每日加分、蛋档位、稀有概率
│   │   ├── report.ts            # 日报、周报生成（纯函数）
│   │   ├── summon.ts            # 精灵判定：隐藏→首见→金额档→进化→兜底
│   │   ├── monster.ts           # 账单 → 怪物，分 3 波
│   │   └── tower.ts             # 塔防引擎：地图、放置、自动攻击、胜负
│   ├── store/
│   │   └── useIsland.ts         # useReducer + Context，全局 state
│   └── components/
│       ├── Island.tsx           # 家园岛 + 月光湖（SVG，2.5D）
│       ├── QuickAdd.tsx         # 记一笔：一键模板 + 表单
│       ├── DailyReport.tsx      # 日报卡片
│       ├── WeeklyReport.tsx     # 周报卡片
│       ├── Egg.tsx              # 蛋 + 品质升级动画
│       ├── Codex.tsx            # 精灵图鉴 32 只
│       ├── TowerGame.tsx        # 塔防小游戏（独立页面 / 弹窗）
│       └── Farm.tsx             # 种地 3 块地（可选，Phase 2 后做）
└── public/
    └── (无外部图片，SVG 都内联在代码里)
```

开发顺序（按这个顺序让 Qoder 做，不要一次全做）：

1. `types.ts` + `storage.ts` + `ledger.ts` → 能记账、能刷新不丢
2. `budget.ts` + `report.ts` + `DailyReport.tsx` + `WeeklyReport.tsx` → 能出日报周报
3. `egg.ts` + `Egg.tsx` + `summon.ts` + `Codex.tsx` → 蛋和图鉴
4. `monster.ts` + `tower.ts` + `TowerGame.tsx` → 塔防（可跳过）
5. `Island.tsx` + `Farm.tsx` → 家园视觉和种地

## 2. 数据模型（types.ts，先写死）

```ts
// 分类：8 个，写死，不要让用户自定义
export type Category = '外卖' | '奶茶' | '夜宵' | '快递' | '交通' | '学习' | '日用' | '娱乐';

export interface Transaction {
  id: string;              // crypto.randomUUID()
  amount: number;          // 金额，保留 2 位小数
  category: Category;
  note: string;            // 备注，可空，用于关键词召唤
  time: string;            // ISO 字符串，YYYY-MM-DDTHH:mm
  date: string;            // YYYY-MM-DD，方便按天统计，不要每次算
  monsterHp: number;       // 怪物血量 = round(amount / 15)，记账时算好存起来
}

export interface Spirit {
  id: string;              // 如 milk-tea-01
  name: string;            // 珍珠圆圆
  category: Category;
  rarity: '普通' | '稀有' | '隐藏';
  collected: boolean;
  count: number;           // 出现次数，3 次进化
  evolved: boolean;
}

export interface EggState {
  cycleStart: string;      // 本期开始日，YYYY-MM-DD，周一
  score: number;           // 当前总分，0-115
  dailyScores: Record<string, number>; // 日期 -> 当天加分，0 / 10 / 15
  tier: '普通' | '银' | '金' | null;  // 第 7 天结算后才定
  hatched: boolean;
  hatchedSpiritId: string | null;
  skippedTower: boolean;   // 是否跳过塔防
}

export interface Budgets {
  daily: number;           // 默认 50
  weekly: number;          // 默认 350，= daily * 7
}

export interface TowerState {
  played: boolean;
  won: boolean | null;
  islandHp: number;        // 100 点
  skipped: boolean;
}

export interface IslandState {
  transactions: Transaction[];
  spirits: Record<string, Spirit>;
  egg: EggState;
  budgets: Budgets;
  tower: TowerState;
  farm: { plots: { seed: string | null; days: number }[] };
  settings: { wishPoolEnabled: boolean }; // 许愿池开关，默认 true
}
```

关键点：

- `date` 字段单独存，不要每次用 `new Date(time)` 去算，时区会出 bug。
- `monsterHp` 记账时算好存起来，塔防直接读，不要每次重算。
- `dailyScores` 用日期做 key，重复结算同一天时覆盖，不累加。这是防刷的核心。

## 3. 存储层（storage.ts）

```ts
const KEY = 'money-island:v1'; // 键名不许改，旧数据不要丢

export function loadState(): IslandState {
  const raw = localStorage.getItem(KEY);
  if (!raw) return seedState(); // 第一次打开，生成种子数据
  try {
    return migrate(JSON.parse(raw)); // 版本迁移放这里
  } catch {
    return seedState();
  }
}

export function saveState(s: IslandState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
```

- 每次 state 变了就 `saveState`，不要等用户点保存。
- `seedState()` 按 DATA-PLAN.md 生成约 120 笔、18/32 精灵，只在第一次打开时生成一次。
- 导出 JSON 备份就是 `JSON.stringify(loadState())` 下载，导入就是读文件 → `JSON.parse` → 校验字段 → `saveState`。

## 4. 记账（ledger.ts，3 秒完成的核心）

```ts
// 一键记账模板，点一下就记完，不用填表单
export const QUICK_TEMPLATES = [
  { label: '蜜雪冰城', amount: 18, category: '奶茶' as const },
  { label: '瑞幸', amount: 15, category: '奶茶' as const },
  { label: '外卖', amount: 23, category: '外卖' as const },
  { label: '公交', amount: 2, category: '交通' as const },
];

export function addTransaction(
  s: IslandState,
  input: { amount: number; category: Category; note?: string; time?: string }
): IslandState {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    amount: Math.round(input.amount * 100) / 100,
    category: input.category,
    note: input.note ?? '',
    time: input.time ?? new Date().toISOString(),
    date: toDateString(input.time ?? new Date()),
    monsterHp: Math.round(input.amount / 15), // 1 点 = 15 元，写死
  };
  // 每天召唤上限 5 只：先算今天已召唤数，超过就只加能量
  const summoned = pickSummon(s, tx); // 见 summon.ts
  return { ...s, transactions: [tx, ...s.transactions], spirits: summoned.spirits };
}
```

- 金额用 `Math.round(x * 100) / 100`，不要用浮点直接加减，0.1 + 0.2 会出 bug。
- 分类统计用 `reduce`，不要每次遍历全表去算，数据量小（120 笔）可以直接算，但要写成纯函数，方便测试。

```ts
export function sumByCategory(txs: Transaction[]) {
  const map = new Map<Category, number>();
  for (const t of txs) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]); // 从大到小，Top 3 直接取前 3
}
```

## 5. 每日加分与蛋（egg.ts，纯函数）

```ts
export function dailyScore(spent: number, dailyBudget: number): number {
  if (spent <= dailyBudget * 0.8) return 15; // 完美
  if (spent <= dailyBudget) return 10;       // 守住
  return 0;                                  // 超支，不扣分
}

export function eggTier(score: number): '普通' | '银' | '金' {
  if (score >= 70) return '金';
  if (score >= 30) return '银';
  return '普通';
}

export function rareChance(tier: '普通' | '银' | '金'): number {
  return tier === '金' ? 40 : tier === '银' ? 25 : 10;
}
```

每日结算流程（第二天第一次打开时跑一遍，不要用定时器）：

```ts
export function settleDay(s: IslandState, date: string): IslandState {
  if (s.egg.dailyScores[date] !== undefined) return s; // 今天已结算，不重复加
  const spent = sumByDate(s.transactions, date);
  const score = dailyScore(spent, s.budgets.daily);
  return {
    ...s,
    egg: {
      ...s.egg,
      score: s.egg.score + score,
      dailyScores: { ...s.egg.dailyScores, [date]: score },
    },
  };
}
```

- 不要用 `setInterval` / `setTimeout` 做结算，静态网页没有服务端定时任务。所有结算都是“下次打开时算一遍”。
- 第 7 天晚上：`eggTier(score)` 定档 → 播升级动画 → 按 `rareChance` 随机出精灵 → `hatched = true`。

## 6. 日报与周报（report.ts，纯函数，先做这个）

```ts
export interface DailyReport {
  date: string;
  spent: number;
  budget: number;
  saved: number;           // max(0, budget - spent)
  topCategories: { category: Category; amount: number; pct: number }[];
  biggest: Transaction | null;
  eggAdded: number;        // 今天 +10 / +15 / 0
  eggTotal: number;
  tip: string;             // 只给一条建议
}

export function buildDailyReport(s: IslandState, date: string): DailyReport {
  const txs = s.transactions.filter(t => t.date === date);
  const spent = sum(txs);
  const top = sumByCategory(txs).slice(0, 3);
  const biggest = txs.reduce((a, b) => (a.amount > b.amount ? a : b), txs[0] ?? null);
  return {
    date, spent,
    budget: s.budgets.daily,
    saved: Math.max(0, s.budgets.daily - spent),
    topCategories: top.map(([category, amount]) => ({
      category, amount, pct: spent ? Math.round(amount / spent * 100) : 0,
    })),
    biggest,
    eggAdded: dailyScore(spent, s.budgets.daily),
    eggTotal: s.egg.score,
    tip: makeTip(top[0]), // 例：奶茶占 42%，明天少一杯就能守住预算
  };
}
```

周报同理，只是把 7 天的数据汇总：

```ts
export interface WeeklyReport {
  weekStart: string;
  spent: number;
  budget: number;          // 周预算 350
  goodDays: number;        // 守住的天数，例 5 / 7
  dailyBars: { date: string; spent: number }[]; // 7 根小柱子
  topCategories: { category: Category; amount: number; pct: number }[];
  biggest: Transaction | null;
  saved: number;
  tip: string;
}
```

- 报告是用户点击“生成今日总结” / “生成周总结”时才算，不要自动弹窗。
- 报告组件只负责显示 `DailyReport` / `WeeklyReport` 对象，不要在组件里算钱。
- 周报卡片下载图片：用 `html2canvas` 或者直接用 CSS 画一张竖版卡片截图，不要用服务端。

## 7. 精灵判定（summon.ts）

按顺序走，先命中先出：

```ts
export function pickSummon(s: IslandState, tx: Transaction): { spiritId: string | null } {
  // 1. 隐藏款：关键词 + 金额 / 时间
  //    例：18 元奶茶 + "三分糖" → 珍珠圆圆；23 点后夜宵 + "螺蛳粉" → 夜宵兽王
  // 2. 分类首见：该分类第一次记账，必出新精灵
  // 3. 金额档：<10 普通，10-30 有概率稀有，30-100 稀有概率提高
  // 4. 重复 3 次进化：同一只出 3 次，第 3 次进化
  // 5. 兜底随机：按 tx.id 做种子随机，保证同一天同类不连出两只一样的
}
```

- 每天上限 5 只：在 `addTransaction` 里先算今天已召唤数，`>= 5` 就返回 `null`，只加岛屿能量。
- 随机数不要用 `Math.random()` 直接出结果，要用 `tx.id` 做种子，保证同一笔账单每次打开都出同一只精灵，不然刷新后图鉴会变。

## 8. 怪物生成（monster.ts）

```ts
export interface Monster {
  id: string;              // tx.id
  name: string;            // 外卖怪 / 奶茶怪
  category: Category;
  hp: number;              // = round(amount / 15)
  maxHp: number;
  speed: number;           // 外卖慢、奶茶快、交通最快
  amount: number;
}

export function buildMonsters(txs: Transaction[]): Monster[][] {
  // 按时间分 3 波：周一-周三、周四-周五、周六-周日
  // 每波最多 10 只，超过的合并成一只大怪（血量相加）
  // 一周没记账：返回 [[], [], []]，显示“本周没有怪物”
}
```

怪物速度表（写死在 `monster.ts` 顶部）：

| 分类 | 速度 | 说明 |
|---|---|---|
| 外卖 | 慢 | 血厚 |
| 奶茶 | 快 | 血少 |
| 夜宵 | 快 | 晚上出现 |
| 快递 | 慢 | 血中等 |
| 交通 | 最快 | 血少 |
| 学习 | 慢 | 血厚 |
| 日用 | 中 | 血中等 |
| 娱乐 | 中 | 偶尔跳一格 |

## 9. 塔防引擎（tower.ts，独立的小引擎）

不要用 Three.js，不要用 Canvas 游戏引擎，用 DOM + `requestAnimationFrame` 就够了，3-5 分钟一局，手机也能跑。

### 9.1 地图

- 地图是一个 8 列 × 5 行的网格，路是一条固定路径，写死在 `tower.ts` 里：
```ts
// 路径坐标，怪物按这个顺序走
export const PATH = [
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 },
  { x: 2, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }, { x: 7, y: 2 },
];
// 放置格：路两边的空地，6-8 个
export const SLOTS = [
  { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 1 },
  { x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 },
];
```

- 岛中心在路径终点，怪物走到终点扣血。

### 9.2 游戏循环（核心就 30 行）

```ts
// 每帧（requestAnimationFrame）做 3 件事，不要每帧都 setState
function tick(dt: number) {
  // 1. 怪物沿 PATH 移动：pos += speed * dt
  // 2. 精灵自动攻击：找射程内最近的怪物，冷却到了就扣血
  // 3. 怪物到终点：岛血量 -= 怪物剩余血量，怪物消失
}
```

- 精灵攻击：`attack = rarity 攻击力（普通 1 / 稀有 2 / 隐藏 3）`，同类伤害翻倍。
- 射程：用格子距离算，`|dx| + |dy| <= range`，不要用像素距离。
- 状态更新：用 `useRef` 存怪物位置和血量，每帧只更新 DOM / Canvas，不要每帧都 `setState`，不然会卡。
- 1 倍 / 2 倍速：`dt * speedMultiplier`，暂停就是 `dt = 0`。

### 9.3 胜负与跳过

```ts
// 打完 3 波，岛血量 > 0：胜利，得 1 颗种子 + 下周蛋 +10 分起步
// 岛血量 = 0：失败，无奖励，图鉴、蛋、账单都不清零
// 点“跳过塔防”：直接设置 tower.skipped = true，不打、不给种子、不给 +10 分
// 跳过后，下周一新蛋从 0 分开始
```

- 塔防组件 `TowerGame.tsx` 只负责显示和放置，胜负逻辑在 `tower.ts` 里。
- 塔防是可选玩法，`App.tsx` 里用条件渲染：`if (!tower.played) 显示塔防入口`，跳过后直接隐藏。

## 10. 状态管理（useIsland.ts）

```ts
// 用 useReducer + Context，不要用 Redux，太重了
// 每次 dispatch 后自动 saveState

export function useIsland() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => saveState(state), [state]);
  return { state, dispatch };
}

// reducer 只做 5 个动作，不要写 20 个：
// ADD_TX / SET_BUDGET / SETTLE_DAY / HATCH_EGG / SKIP_TOWER / PLAY_TOWER
```

- 每个动作都是纯函数，先算出新 state，再保存。
- 演示按钮（演示孵化、演示塔防）只改演示用的临时 state，不要写进正式 `egg` / `tower` 里。这是之前 GitHub 版的 bug：演示结果写进了正式图鉴。

## 11. 动画（CSS 就够了，不要引动画库）

- 蛋品质升级动画：CSS `@keyframes eggGlow`，蛋亮一下、+N 分飘出来，≤3 秒，可跳过（点一下蛋就跳过）。
- 蛋孵化动画：CSS `crack` 3 下，蛋壳裂开，出精灵。
- 月光湖上涨：SVG `waterLevel` 高度从 0% 到 X%，用 CSS `transition: height 0.8s ease`。
- 怪物动画：CSS `walk`，怪物沿路径移动，不要用 JS 每帧算位置去改 style。

## 12. 部署（GitHub Pages）

```bash
# vite.config.ts 里加 base
export default defineConfig({
  base: '/save-money/', // 仓库名，不加这个，GitHub Pages 上 CSS 和 JS 会 404
  build: { outDir: 'dist' },
});
```

```bash
npm run build
# 把 dist 推到 gh-pages 分支，或者用 GitHub Actions 自动部署
# 部署后用无痕浏览器打开 https://reg-passion.github.io/save-money/ 确认
```

## 13. 开发顺序检查清单

- [ ] 第 1 步：记账能跑，刷新不丢，常用模板一键记
- [ ] 第 2 步：日报、周报能点出来，数字都对
- [ ] 第 3 步：蛋能加分、能定档、能孵出精灵
- [ ] 第 4 步：塔防能打、能跳过、跳过没有奖励
- [ ] 第 5 步：家园岛和种地能看，手机不卡

## 14. 常见坑（别踩）

1. **不要用 `Math.random()` 决定精灵**：刷新后会变，用 `tx.id` 做种子。
2. **不要用 `setInterval` 做结算**：静态网页没有定时任务，下次打开时算一遍。
3. **不要每帧 `setState`**：塔防用 `useRef` 存怪物位置，只在胜负时 `setState`。
4. **不要用浮点直接加减金额**：`Math.round(x * 100) / 100`。
5. **不要把演示结果写进正式数据**：演示 state 和正式 state 分开。
6. **不要用 `file://` 测试**：用 `npm run dev` 或部署后测，`file://` 下 localStorage 和路由会出问题。
