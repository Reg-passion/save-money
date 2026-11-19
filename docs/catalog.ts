// ============================================================
// 钱钱岛 Money Island — 精灵图鉴 catalog.ts
// 用法：直接放进 Qoder 项目的 src/data/catalog.ts 里
// 不需要任何外部图片文件，32 只精灵全部用内联 SVG 程序化生成
//
// 设计思路：8 个分类 = 8 个底座身体
//   普通：底色身体
//   稀有：底色 + 金边 + 星星
//   隐藏：底色 + 发光 + 特殊配件
//   进化：身体变大 + 加王冠
// 怪物 = 同一只精灵，表情改成生气、颜色改暗，不用单独画
// ============================================================

export type Category =
  | '外卖' | '奶茶' | '夜宵' | '快递'
  | '交通' | '学习' | '日用' | '娱乐';

export type Rarity = '普通' | '稀有' | '隐藏';
export type BaseShape = 'round' | 'square'; // 圆身体 / 方身体，两种就够了

export interface SpiritDef {
  id: string;              // 如 'milk-tea-01'，不要改，localStorage 靠它认精灵
  name: string;
  category: Category;
  rarity: Rarity;
  base: BaseShape;
  color: string;           // 身体主色
  belly: string;           // 肚子 / 高光色
  accessory: string;       // 配件：'straw' | 'crown' | 'glasses' | 'hat' | 'headphone' | 'tape' | 'wheel' | 'moon' | 'none'
  hint: string;            // 图鉴里的谜语提示，隐藏款不要写直白条件
  unlock: string;          // 出现条件（给 Qoder 看的，图鉴里只显示 hint）
  attack: number;          // 塔防攻击力：普通 1 / 稀有 2 / 隐藏 3
  range: number;           // 塔防射程：普通 2 / 稀有 2 / 隐藏 3
  speed: '慢' | '中' | '快' | '最快'; // 怪物速度，精灵不用，怪物用
}

// ------------------------------------------------------------
// 1. 分类底座：8 个分类的颜色和配件，改这里就能改全站配色
// ------------------------------------------------------------
export const CATEGORY_STYLE: Record<Category, {
  color: string; belly: string; base: BaseShape; accessory: string;
}> = {
  '外卖': { color: '#FF9F43', belly: '#FFE0B2', base: 'round',  accessory: 'lid' },
  '奶茶': { color: '#F7B6D9', belly: '#FFF0F6', base: 'round',  accessory: 'straw' },
  '夜宵': { color: '#9B7EDE', belly: '#E6DEFF', base: 'round',  accessory: 'moon' },
  '快递': { color: '#F5C542', belly: '#FFF3C4', base: 'square', accessory: 'tape' },
  '交通': { color: '#4ECDC4', belly: '#D2F5F2', base: 'round',  accessory: 'wheel' },
  '学习': { color: '#6C8CFF', belly: '#DCE6FF', base: 'square', accessory: 'glasses' },
  '日用': { color: '#7ED6A5', belly: '#E2F7EC', base: 'round',  accessory: 'hat' },
  '娱乐': { color: '#FF6B81', belly: '#FFE0E6', base: 'round',  accessory: 'headphone' },
};

// ------------------------------------------------------------
// 2. 32 只精灵全表
//    总数：普通 18 / 稀有 10 / 隐藏 4，共 32 只
//    每类 4 只，初始已收集 18 只（见文件底部的 SEED_COLLECTED_IDS）
// ------------------------------------------------------------
export const SPIRITS: SpiritDef[] = [
  // ---- 外卖：普、普、稀、隐 ----
  { id: 'takeout-01', name: '外卖小怪', category: '外卖', rarity: '普通', base: 'round', color: '#FF9F43', belly: '#FFE0B2', accessory: 'lid', hint: '第一次点外卖，它会来打招呼。', unlock: '分类首见：第一次记外卖', attack: 1, range: 2, speed: '慢' },
  { id: 'takeout-02', name: '干饭人', category: '外卖', rarity: '普通', base: 'round', color: '#FFB26B', belly: '#FFE0B2', accessory: 'lid', hint: '干饭不积极，思想有问题。', unlock: '外卖记满 5 笔', attack: 1, range: 2, speed: '慢' },
  { id: 'takeout-03', name: '干饭大王', category: '外卖', rarity: '稀有', base: 'round', color: '#FF8A00', belly: '#FFD9A0', accessory: 'crown', hint: '只有真正的干饭人才能见到它。', unlock: '同一只出 3 次进化', attack: 2, range: 2, speed: '慢' },
  { id: 'takeout-04', name: '深夜干饭兽', category: '外卖', rarity: '隐藏', base: 'round', color: '#E85D3D', belly: '#FFC9B8', accessory: 'moon', hint: '夜里十一点后，它才出来找吃的。', unlock: '23:00 后记外卖', attack: 3, range: 3, speed: '中' },

  // ---- 奶茶：普、普、稀、稀 ----
  { id: 'milk-tea-01', name: '奶茶小怪', category: '奶茶', rarity: '普通', base: 'round', color: '#F7B6D9', belly: '#FFF0F6', accessory: 'straw', hint: '第一次喝奶茶，它就出现了。', unlock: '分类首见：第一次记奶茶', attack: 1, range: 2, speed: '快' },
  { id: 'milk-tea-02', name: '珍珠宝宝', category: '奶茶', rarity: '普通', base: 'round', color: '#F9A8C9', belly: '#FFF0F6', accessory: 'straw', hint: '圆圆的，甜甜的，喜欢加珍珠。', unlock: '奶茶记满 5 笔', attack: 1, range: 2, speed: '快' },
  { id: 'milk-tea-03', name: '珍珠圆圆', category: '奶茶', rarity: '稀有', base: 'round', color: '#E88BB8', belly: '#FFE6F2', accessory: 'crown', hint: '三分糖，去冰，它最喜欢这个配方。', unlock: '18 元奶茶 + 备注“三分糖”', attack: 2, range: 2, speed: '快' },
  { id: 'milk-tea-04', name: '奶茶大王', category: '奶茶', rarity: '稀有', base: 'round', color: '#D96AA8', belly: '#FFE6F2', accessory: 'crown', hint: '珍珠圆圆长大了，成了奶茶大王。', unlock: '珍珠圆圆出 3 次进化', attack: 2, range: 2, speed: '快' },

  // ---- 夜宵：普、普、稀、隐 ----
  { id: 'midnight-01', name: '夜宵小怪', category: '夜宵', rarity: '普通', base: 'round', color: '#9B7EDE', belly: '#E6DEFF', accessory: 'moon', hint: '夜里饿了，它比你先醒。', unlock: '分类首见：第一次记夜宵', attack: 1, range: 2, speed: '快' },
  { id: 'midnight-02', name: '螺蛳粉精', category: '夜宵', rarity: '普通', base: 'round', color: '#8A6FD6', belly: '#E6DEFF', accessory: 'moon', hint: '闻着臭，吃着香，别问为什么。', unlock: '夜宵记满 5 笔', attack: 1, range: 2, speed: '快' },
  { id: 'midnight-03', name: '夜宵兽', category: '夜宵', rarity: '稀有', base: 'round', color: '#7A5CC8', belly: '#DCD2FF', accessory: 'crown', hint: '烧烤摊上最能吃的那只。', unlock: '同一只出 3 次进化', attack: 2, range: 2, speed: '快' },
  { id: 'midnight-04', name: '夜宵兽王', category: '夜宵', rarity: '隐藏', base: 'round', color: '#6A4AB8', belly: '#DCD2FF', accessory: 'moon', hint: '23 点之后，螺蛳粉的香味会叫醒它。', unlock: '23:00 后夜宵 + 备注“螺蛳粉”', attack: 3, range: 3, speed: '快' },

  // ---- 快递：普、普、稀、隐 ----
  { id: 'parcel-01', name: '快递箱小怪', category: '快递', rarity: '普通', base: 'square', color: '#F5C542', belly: '#FFF3C4', accessory: 'tape', hint: '拆箱子的时候，它总在旁边看。', unlock: '分类首见：第一次记快递', attack: 1, range: 2, speed: '慢' },
  { id: 'parcel-02', name: '拆箱怪', category: '快递', rarity: '普通', base: 'square', color: '#EFB93A', belly: '#FFF3C4', accessory: 'tape', hint: '最喜欢听胶带撕开的声音。', unlock: '快递记满 5 笔', attack: 1, range: 2, speed: '慢' },
  { id: 'parcel-03', name: '剁手精', category: '快递', rarity: '稀有', base: 'square', color: '#E5A90F', belly: '#FFE9A8', accessory: 'crown', hint: '它说：这次是最后一次买。', unlock: '单笔快递 ≥30 元', attack: 2, range: 2, speed: '慢' },
  { id: 'parcel-04', name: '剁手大王', category: '快递', rarity: '隐藏', base: 'square', color: '#D99A00', belly: '#FFE9A8', accessory: 'crown', hint: '购物车满了，它就来了。', unlock: '单笔快递 ≥100 元（先进许愿池，确认后出）', attack: 3, range: 3, speed: '中' },

  // ---- 交通：普、普、稀、稀 ----
  { id: 'traffic-01', name: '小电驴', category: '交通', rarity: '普通', base: 'round', color: '#4ECDC4', belly: '#D2F5F2', accessory: 'wheel', hint: '校园里跑得最快的小家伙。', unlock: '分类首见：第一次记交通', attack: 1, range: 2, speed: '最快' },
  { id: 'traffic-02', name: '赶路兽', category: '交通', rarity: '普通', base: 'round', color: '#3DBDB5', belly: '#D2F5F2', accessory: 'wheel', hint: '快要迟到了？它比你还急。', unlock: '交通记满 5 笔', attack: 1, range: 2, speed: '最快' },
  { id: 'traffic-03', name: '末班车守护', category: '交通', rarity: '稀有', base: 'round', color: '#2BA8A0', belly: '#C2EDE9', accessory: 'crown', hint: '最后一班车，它会等你。', unlock: '22:00 后记交通', attack: 2, range: 2, speed: '最快' },
  { id: 'traffic-04', name: '飞驰小子', category: '交通', rarity: '稀有', base: 'round', color: '#1F968E', belly: '#C2EDE9', accessory: 'wheel', hint: '风一样的小子，追不上它。', unlock: '同一只出 3 次进化', attack: 2, range: 2, speed: '最快' },

  // ---- 学习：普、普、普、稀 ----
  { id: 'study-01', name: '书本怪', category: '学习', rarity: '普通', base: 'square', color: '#6C8CFF', belly: '#DCE6FF', accessory: 'glasses', hint: '书堆里长出来的小家伙。', unlock: '分类首见：第一次记学习', attack: 1, range: 2, speed: '慢' },
  { id: 'study-02', name: '论文兽', category: '学习', rarity: '普通', base: 'square', color: '#5A7BF5', belly: '#DCE6FF', accessory: 'glasses', hint: '截止日期前夜，它最活跃。', unlock: '学习记满 5 笔', attack: 1, range: 2, speed: '慢' },
  { id: 'study-03', name: '文具精', category: '学习', rarity: '普通', base: 'square', color: '#7A9BFF', belly: '#E6EEFF', accessory: 'glasses', hint: '最喜欢新本子和新笔。', unlock: '学习记满 10 笔', attack: 1, range: 2, speed: '慢' },
  { id: 'study-04', name: '考前突击兽', category: '学习', rarity: '稀有', base: 'square', color: '#4A6BE8', belly: '#C9D8FF', accessory: 'crown', hint: '考试前 3 天，它会突然出现。', unlock: '单笔学习 ≥50 元', attack: 2, range: 2, speed: '慢' },

  // ---- 日用：普、普、普、稀 ----
  { id: 'daily-01', name: '纸巾怪', category: '日用', rarity: '普通', base: 'round', color: '#7ED6A5', belly: '#E2F7EC', accessory: 'hat', hint: '宿舍里最常见的居民。', unlock: '分类首见：第一次记日用', attack: 1, range: 2, speed: '中' },
  { id: 'daily-02', name: '囤货兽', category: '日用', rarity: '普通', base: 'round', color: '#6CCB96', belly: '#E2F7EC', accessory: 'hat', hint: '打折的时候，它囤得最多。', unlock: '日用记满 5 笔', attack: 1, range: 2, speed: '中' },
  { id: 'daily-03', name: '洗护精', category: '日用', rarity: '普通', base: 'round', color: '#8ADFB4', belly: '#EAF9F0', accessory: 'hat', hint: '香香的，爱干净的小家伙。', unlock: '日用记满 10 笔', attack: 1, range: 2, speed: '中' },
  { id: 'daily-04', name: '宿舍百宝兽', category: '日用', rarity: '稀有', base: 'round', color: '#5ABF87', belly: '#D2F2DF', accessory: 'crown', hint: '宿舍里什么都有，问它就对了。', unlock: '蛋孵出的稀有精灵（演示也出过它）', attack: 2, range: 2, speed: '中' },

  // ---- 娱乐：普、普、稀、隐 ----
  { id: 'fun-01', name: '游戏小怪', category: '娱乐', rarity: '普通', base: 'round', color: '#FF6B81', belly: '#FFE0E6', accessory: 'headphone', hint: '开黑的时候，它总在旁边。', unlock: '分类首见：第一次记娱乐', attack: 1, range: 2, speed: '中' },
  { id: 'fun-02', name: '开黑小子', category: '娱乐', rarity: '普通', base: 'round', color: '#FF5A73', belly: '#FFE0E6', accessory: 'headphone', hint: '五排缺一？叫它。', unlock: '娱乐记满 5 笔', attack: 1, range: 2, speed: '中' },
  { id: 'fun-03', name: '开黑兽', category: '娱乐', rarity: '稀有', base: 'round', color: '#F04A65', belly: '#FFC9D2', accessory: 'crown', hint: '连胜的时候，它会出来庆祝。', unlock: '同一只出 3 次进化', attack: 2, range: 2, speed: '中' },
  { id: 'fun-04', name: '熬夜冠军', category: '娱乐', rarity: '隐藏', base: 'round', color: '#E03A55', belly: '#FFC9D2', accessory: 'moon', hint: '凌晨两点还不睡的人，才能见到它。', unlock: '凌晨 0:00-2:00 记娱乐', attack: 3, range: 3, speed: '中' },
];

// ------------------------------------------------------------
// 3. 初始已收集 18 / 32（种子数据用，真实用户从 0 开始）
//    选的是每类最常见的 2-3 只，4 只隐藏款全都不在里面
// ------------------------------------------------------------
export const SEED_COLLECTED_IDS = [
  'takeout-01', 'takeout-02',
  'milk-tea-01', 'milk-tea-02',
  'midnight-01', 'midnight-02',
  'parcel-01', 'parcel-02',
  'traffic-01', 'traffic-02',
  'study-01', 'study-02',
  'daily-01', 'daily-02',
  'fun-01', 'fun-02',
  'takeout-03', 'milk-tea-03',
];

// ------------------------------------------------------------
// 4. 查找函数（给 Qoder 用，不要在组件里自己 filter）
// ------------------------------------------------------------
export function getSpirit(id: string): SpiritDef | undefined {
  return SPIRITS.find(s => s.id === id);
}

export function spiritsByCategory(category: Category): SpiritDef[] {
  return SPIRITS.filter(s => s.category === category);
}

export function countByRarity(rarity: Rarity): number {
  return SPIRITS.filter(s => s.rarity === rarity).length;
  // 普通 18 / 稀有 10 / 隐藏 4，改表后跑一下这个函数验证
}

// ------------------------------------------------------------
// 5. SVG 生成：核心就这一个函数
//    参数：精灵定义 + 大小 + 是否进化 + 是否怪物 + 是否已收集
//    返回：一段可以直接插进 React 的 SVG 字符串
//    怪物 = 同一只精灵，isMonster=true 时表情变生气、颜色变暗
//    未收集 = collected=false 时返回剪影（全灰 + 问号），不要画细节
// ------------------------------------------------------------
export function spiritSvg(
  def: SpiritDef,
  opts: { size?: number; evolved?: boolean; isMonster?: boolean; collected?: boolean } = {}
): string {
  const size = opts.size ?? 64;
  const evolved = opts.evolved ?? false;
  const isMonster = opts.isMonster ?? false;
  const collected = opts.collected ?? true;

  // 未收集：剪影，不画脸和配件
  if (!collected) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64">
      <circle cx="32" cy="34" r="22" fill="#CBD5E1"/>
      <circle cx="32" cy="34" r="22" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="4 3"/>
      <text x="32" y="40" text-anchor="middle" font-size="20" fill="#64748B">?</text>
    </svg>`;
  }

  const body = isMonster ? shade(def.color, -30) : def.color;
  const scale = evolved ? 1.15 : 1; // 进化变大 15%
  const eye = isMonster ? '><' : '•'; // 怪物是 >< 眼，精灵是圆眼（用 SVG 画，不是真的字符）
  void eye;

  const bodyShape = def.base === 'round'
    ? `<circle cx="32" cy="34" r="${22 * scale}" fill="${body}"/>`
    : `<rect x="${10}" y="${12}" width="44" height="44" rx="12" fill="${body}"/>`;

  const belly = `<ellipse cx="32" cy="44" rx="12" ry="8" fill="${def.belly}" opacity="0.8"/>`;

  // 脸：精灵是笑眼 + 微笑，怪物是怒眼 + 锯齿嘴
  const face = isMonster
    ? `<path d="M22 30 L28 34 M42 30 L36 34" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
       <path d="M24 44 L28 41 L32 44 L36 41 L40 44" stroke="#1F2937" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<circle cx="25" cy="32" r="2.5" fill="#1F2937"/><circle cx="39" cy="32" r="2.5" fill="#1F2937"/>
       <path d="M27 40 Q32 44 37 40" stroke="#1F2937" stroke-width="2" fill="none" stroke-linecap="round"/>`;

  // 配件：只画 4 种，其他用圆点代替，不要每种都画复杂图形
  const accessory = accessorySvg(def.accessory, evolved);
  const ring = def.rarity === '稀有'
    ? `<circle cx="32" cy="34" r="26" fill="none" stroke="#F5C542" stroke-width="2"/>`
    : def.rarity === '隐藏'
    ? `<circle cx="32" cy="34" r="26" fill="none" stroke="#9B7EDE" stroke-width="2" stroke-dasharray="5 3"/>
       <circle cx="32" cy="34" r="28" fill="none" stroke="#C4B5FD" stroke-width="1" opacity="0.6"/>`
    : '';

  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64">
    ${ring}
    ${bodyShape}
    ${belly}
    ${face}
    ${accessory}
  </svg>`;
}

function accessorySvg(accessory: string, evolved: boolean): string {
  // 王冠只在稀有 / 隐藏 / 进化时出现，普通精灵不戴
  switch (accessory) {
    case 'straw': // 吸管：右上角一根斜线
      return `<line x1="42" y1="12" x2="48" y2="26" stroke="#F97316" stroke-width="3" stroke-linecap="round"/>`;
    case 'crown': // 王冠：头顶三个尖
      return `<path d="M22 14 L26 8 L32 13 L38 8 L42 14 Z" fill="#F5C542" stroke="#D99A00" stroke-width="1"/>`;
    case 'glasses': // 眼镜：两个圈 + 横线
      return `<circle cx="25" cy="32" r="5" fill="none" stroke="#1F2937" stroke-width="1.5"/><circle cx="39" cy="32" r="5" fill="none" stroke="#1F2937" stroke-width="1.5"/><line x1="30" y1="32" x2="34" y2="32" stroke="#1F2937" stroke-width="1.5"/>`;
    case 'moon': // 月亮：头顶小月牙
      return `<path d="M46 10 A6 6 0 1 0 46 20 A4 4 0 1 1 46 10" fill="#FDE68A"/>`;
    case 'headphone': // 耳机：头顶弧线 + 两边耳罩
      return `<path d="M20 32 A12 12 0 0 1 44 32" fill="none" stroke="#1F2937" stroke-width="2"/><rect x="18" y="30" width="5" height="8" rx="2" fill="#1F2937"/><rect x="41" y="30" width="5" height="8" rx="2" fill="#1F2937"/>`;
    case 'tape': // 胶带：方身体中间一条横带
      return `<rect x="10" y="30" width="44" height="6" fill="#FFFFFF" opacity="0.7"/>`;
    case 'wheel': // 车轮：底部两个小轮子
      return `<circle cx="22" cy="54" r="4" fill="#1F2937"/><circle cx="42" cy="54" r="4" fill="#1F2937"/>`;
    case 'hat': // 帽子：头顶一顶小帽
      return `<path d="M22 16 Q32 6 42 16 Z" fill="#5ABF87"/>`;
    case 'lid': // 饭盒盖：头顶一条横线
      return `<rect x="20" y="12" width="24" height="4" rx="2" fill="#FFFFFF" opacity="0.8"/>`;
    default:
      return evolved ? `<path d="M22 14 L26 8 L32 13 L38 8 L42 14 Z" fill="#F5C542"/>` : '';
  }
}

// 颜色加深 / 变浅，怪物用（-30 是变暗 30）
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ------------------------------------------------------------
// 6. React 里怎么用（示例，不要把 SVG 字符串直接拼进 JSX 以外的地方）
// ------------------------------------------------------------
// import { SPIRITS, spiritSvg } from '../data/catalog';
//
// function SpiritIcon({ id, size = 64 }: { id: string; size?: number }) {
//   const def = getSpirit(id);
//   if (!def) return null;
//   return <div dangerouslySetInnerHTML={{ __html: spiritSvg(def, { size }) }} />;
// }
//
// // 图鉴里未收集的：
// spiritSvg(def, { size: 64, collected: false })
// // 怪物：
// spiritSvg(def, { size: 64, isMonster: true })
// // 进化后：
// spiritSvg(def, { size: 64, evolved: true })
