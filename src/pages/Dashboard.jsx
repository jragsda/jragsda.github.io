import React, { useRef } from 'react'
import toast from 'react-hot-toast'
import { useAppState } from '@/lib/AppState'
import { Button } from '@/components/button'
import { Check, X, Trophy, Download, Upload } from 'lucide-react'

function scorePlayer(games, picks, playerId) {
  const pickByGame = new Map(picks.filter((p) => p.player_id === playerId).map((p) => [p.game_id, p]))
  let points = 0, right = 0, wrong = 0, pending = 0
  for (const game of games) {
    if (game.status !== 'final' || !game.winner || game.winner === 'tie') {
      pending++
      continue
    }
    const pick = pickByGame.get(game.id)
    if (!pick || !pick.picked_team) {
      wrong++
      continue
    }
    if (pick.picked_team === game.winner) {
      points += pick.confidence
      right++
    } else {
      wrong++
    }
  }
  return { points, right, wrong, pending }
}

function ScoreCard({ player, points, right, wrong, pending, showPending }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{player.name}</div>
        <div className="text-3xl font-bold font-heading">{points}</div>
      </div>
      <div className="mt-3 flex gap-4 text-sm flex-wrap">
        <span className="flex items-center gap-1 text-green-600">
          <Check className="w-4 h-4" /> {right} right
        </span>
        <span className="flex items-center gap-1 text-red-600">
          <X className="w-4 h-4" /> {wrong} wrong
        </span>
        {showPending && <span className="text-muted-foreground">{pending} pending</span>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { season, week, games, players, allGames, allPicks, exportData, importData } = useAppState()
  const fileRef = useRef(null)

  const weekPicks = allPicks.filter((p) => p.season === season && p.week === week)
  const weekScores = players.map((p) => ({ player: p, ...scorePlayer(games, weekPicks, p.id) }))
  const overallScores = players.map((p) => ({ player: p, ...scorePlayer(allGames, allPicks, p.id) }))

  const sorted = [...overallScores].sort((a, b) => b.points - a.points)
  const leader = sorted.length > 1 && sorted[0].points > sorted[1].points ? sorted[0] : null

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'nfl-pool-backup.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      importData(await file.text())
      toast.success('Backup restored')
    } catch {
      toast.error("That file isn't a valid backup")
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Season {season} · Week {week}
        </p>
      </div>

      {leader && (
        <div className="rounded-xl border bg-primary text-primary-foreground p-4 flex items-center gap-3">
          <Trophy className="w-5 h-5" />
          <div className="font-medium">
            {leader.player.name} leads the season with {leader.points} points
          </div>
        </div>
      )}

      <section>
        <h2 className="font-heading font-semibold mb-3">This Week</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {weekScores.map(({ player, ...s }) => (
            <ScoreCard key={player.id} player={player} {...s} showPending />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading font-semibold mb-3">Season Totals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overallScores.map(({ player, ...s }) => (
            <ScoreCard key={player.id} player={player} {...s} pending={0} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading font-semibold mb-1">Backup</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Picks are saved in this browser only. Export a backup to move them to another device or browser.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" /> Import
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={upload} />
        </div>
      </section>
    </div>
  )
}
