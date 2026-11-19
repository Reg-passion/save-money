import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureSeedData } from './data/seed'

try {
  ensureSeedData()
} catch (error) {
  console.error('种子数据生成失败', error)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
