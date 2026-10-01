import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAppState } from '@/lib/AppState'
import { Button } from '@/components/button'
import { Check, X, Minus } from 'lucide-react'

export default function Results() {
  const { season, week, games, players, allPicks, refresh, loading, updateGame } = useAppState()
  const [selections, setSelections] = useState({})

  useEffect(() => {
    const s = {}
    games.forEach((g) => {
      s[g.id] = { winner: g.winner || null, status: g.status || 'scheduled' }
    })
    setSelections(s)
  }, [games])

  const picks = allPicks.filter((p) => p.season === season && p.week === week)
  const pickFor = (gameId, playerId) => picks.find((p) => p.game_id === gameId && p.player_id === playerId)

  const pickWinner = (game, side) => setSelections((st) => ({ ...st, [game.id]: { ...st[game.id], winner: side } }))

  const markFinal = (game) => {
    const sel = selections[game.id]
    if (!sel?.winner) {
      toast.error('Pick a winner first')
      return
    }
    updateGame(game.id, { status: 'final', winner: sel.winner })
    toast.success('Marked final')
  }

  const undoFinal = (game) => updateGame(game.id, { status: 'scheduled', winner: null })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Results — Week {week}</h1>
          <p className="text-sm text-muted-foreground">Scores update automatically on Pull, or set a winner and mark it final.</p>
        </div>
        <Button variant="outline" onClick={() => refresh()} disabled={loading}>
          Pull live scores
        </Button>
      </div>

      {!games.length ? (
        <div className="text-muted-foreground py-12 text-center border rounded-xl">
          No games loaded for this week. Use the Pull button up top.
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const sel = selections[game.id] || { winner: null, status: 'scheduled' }
            const isFinal = game.status === 'final'
            return (
              <div key={game.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => pickWinner(game, 'away')}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 transition text-left ${
                      sel.winner === 'away' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'
                    } ${isFinal && game.winner === 'away' ? 'ring-2 ring-green-500' : ''}`}
                  >
                    {game.away_logo && <img src={game.away_logo} className="w-7 h-7 object-contain" alt="" />}
                    <span className="font-semibold">{game.away_abbr}</span>
                    <span className="text-xs opacity-70 truncate">{game.away_name}</span>
                    {(isFinal || game.status === 'in_progress') && <span className="ml-auto font-bold">{game.away_score}</span>}
                  </button>
                  <span className="text-muted-foreground text-sm">@</span>
                  <button
                    type="button"
                    onClick={() => pickWinner(game, 'home')}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 transition text-right justify-end ${
                      sel.winner === 'home' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'
                    } ${isFinal && game.winner === 'home' ? 'ring-2 ring-green-500' : ''}`}
                  >
                    {(isFinal || game.status === 'in_progress') && <span className="mr-auto font-bold">{game.home_score}</span>}
                    <span className="text-xs opacity-70 truncate">{game.home_name}</span>
                    <span className="font-semibold">{game.home_abbr}</span>
                    {game.home_logo && <img src={game.home_logo} className="w-7 h-7 object-contain" alt="" />}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                  <div className="flex gap-2 flex-wrap">
                    {players.map((p) => {
                      const pick = pickFor(game.id, p.id)
                      let icon = <Minus className="w-4 h-4 text-muted-foreground" />
                      if (isFinal && pick?.picked_team) {
                        icon =
                          pick.picked_team === game.winner ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )
                      }
                      const teamAbbr =
                        pick?.picked_team === 'away' ? game.away_abbr : pick?.picked_team === 'home' ? game.home_abbr : '—'
                      return (
                        <div key={p.id} className="flex items-center gap-1 text-xs rounded-md bg-muted px-2 py-1">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground">
                            {teamAbbr} {pick ? `(${pick.confidence})` : ''}
                          </span>
                          {icon}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    {isFinal ? (
                      <Button size="sm" variant="outline" onClick={() => undoFinal(game)}>
                        Undo
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => markFinal(game)}>
                        Mark Final
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
