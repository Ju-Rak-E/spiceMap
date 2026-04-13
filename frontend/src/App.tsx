import { useState } from 'react'
import Map from './components/Map'
import { MAP_THEME, type MapTheme } from './styles/tokens'
import './App.css'

export default function App() {
  const [theme, setTheme] = useState<MapTheme>('light')

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  const colors = MAP_THEME[theme]

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Map theme={theme} districtFilter={null} />

      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 10,
          padding: '6px 14px',
          borderRadius: 6,
          border: `1px solid ${colors.toggleBorder}`,
          background: colors.toggleBg,
          color: colors.toggleText,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>
    </div>
  )
}
