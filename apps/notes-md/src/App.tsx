import { useEffect } from 'react'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Bridge from './components/Bridge'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const theme = useStore((s) => s.settings.theme)
  useTheme()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (useStore.getState().settings.theme === 'system') {
        document.documentElement.classList.toggle('dark', mq.matches)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <>
      <Bridge />
      <Layout />
    </>
  )
}
