import type { CategoryId } from '../types'

export interface CategoryMeta {
  id: CategoryId
  name: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'takeout', name: '外卖' },
  { id: 'milk-tea', name: '奶茶' },
  { id: 'night-snack', name: '夜宵' },
  { id: 'delivery', name: '快递' },
  { id: 'transport', name: '交通' },
  { id: 'study', name: '学习' },
  { id: 'daily', name: '日用' },
  { id: 'fun', name: '娱乐' },
]
