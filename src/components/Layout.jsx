import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppState } from '@/lib/AppState'
import { Button } from '@/components/button'
import { RefreshCw, BarChart3, ListOrdered, ClipboardCheck, Pencil } from 'lucide-react'

export default function Layout() {
  const { season, week, players, currentPlayer, currentPlayerId, setCurrentPlayerId, renamePlayer, changeWeek, refresh, loading } =
    useAppState()

  const navClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
    }`

  const rename = () => {
    const name = window.prompt('Rename player', currentPlayer?.name || '')
    if (name && name.trim()) renamePlayer(currentPlayerId, name.trim())
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-20 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="font-heading text-lg font-bold tracking-tight">🏈 NFL Confidence Pool</div>
          <div className="text-sm text-muted-foreground">{season}</div>
          <select
            value={week}
            onChange={(e) => changeWeek(Number(e.target.value))}
            disabled={loading}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Pull
          </Button>
          <nav className="flex gap-1 ml-auto">
            <NavLink to="/" end className={navClass}>
              <BarChart3 className="w-4 h-4" /> Dashboard
            </NavLink>
            <NavLink to="/picks" className={navClass}>
              <ListOrdered className="w-4 h-4" /> Picks
            </NavLink>
            <NavLink to="/results" className={navClass}>
              <ClipboardCheck className="w-4 h-4" /> Results
            </NavLink>
          </nav>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Picks for:</span>
          {players.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={p.id === currentPlayerId ? 'default' : 'outline'}
              onClick={() => setCurrentPlayerId(p.id)}
            >
              {p.name}
            </Button>
          ))}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={rename} title="Rename selected player">
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
