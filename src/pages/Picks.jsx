import React, { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import toast from 'react-hot-toast'
import { useAppState } from '@/lib/AppState'
import { Button } from '@/components/button'
import { GripVertical, Save } from 'lucide-react'
import TeamBadge from '@/components/TeamBadge'

export default function Picks() {
  const { season, week, games, allPicks, currentPlayer, currentPlayerId, savePicks } = useAppState()
  const [order, setOrder] = useState([])
  const [selections, setSelections] = useState({})

  // Rebuild the board whenever player / week / games change.
  useEffect(() => {
    const mine = allPicks.filter((p) => p.player_id === currentPlayerId && p.season === season && p.week === week)
    const sel = {}
    const conf = {}
    mine.forEach((p) => {
      sel[p.game_id] = p.picked_team
      conf[p.game_id] = p.confidence
    })
    // highest confidence first; unranked games go to the bottom
    const sorted = [...games].sort((a, b) => (conf[b.id] ?? -1) - (conf[a.id] ?? -1))
    setOrder(sorted.map((g) => g.id))
    setSelections(sel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayerId, season, week, games])

  // Confidence values always run from 16 downward. During bye weeks,
  // the unused lowest values are simply skipped (e.g. 16 → 3 for 14 games).
  const maxConf = 16
  const minConf = Math.max(1, maxConf - games.length + 1)

  const onDragEnd = (result) => {
    if (!result.destination) return
    const items = Array.from(order)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setOrder(items)
  }

  const pick = (gameId, team) => setSelections((s) => ({ ...s, [gameId]: s[gameId] === team ? null : team }))

  const save = () => {
    const newPicks = order.map((gameId, i) => ({
      player_id: currentPlayerId,
      game_id: gameId,
      season,
      week,
      picked_team: selections[gameId] || null,
      confidence: maxConf - i,
    }))
    savePicks(currentPlayerId, newPicks)
    toast.success('Picks saved')
  }

  if (!currentPlayer) return <div className="text-muted-foreground">Add players first.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Picks — {currentPlayer.name}</h1>
          <p className="text-sm text-muted-foreground">
            Drag to rank confidence ({maxConf || '–'} → {minConf}). Click a team to pick the winner.
          </p>
        </div>
        <Button onClick={save} disabled={!games.length}>
          <Save className="w-4 h-4" /> Save Picks
        </Button>
      </div>

      {!games.length ? (
        <div className="text-muted-foreground py-12 text-center border rounded-xl">
          No games loaded for this week. Use the Pull button up top.
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="picks">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {order.map((gameId, index) => {
                  const game = games.find((g) => g.id === gameId)
                  if (!game) return null
                  return (
                    <Draggable key={gameId} draggableId={gameId} index={index}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className="flex items-center gap-3 rounded-xl border bg-card p-3"
                        >
                          <div {...prov.dragHandleProps} className="cursor-grab text-muted-foreground touch-none">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
                            {maxConf - index}
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <TeamBadge
                              abbr={game.away_abbr}
                              name={game.away_name}
                              logo={game.away_logo}
                              selected={selections[gameId] === 'away'}
                              onClick={() => pick(gameId, 'away')}
                            />
                            <span className="text-xs text-muted-foreground shrink-0">@</span>
                            <TeamBadge
                              abbr={game.home_abbr}
                              name={game.home_name}
                              logo={game.home_logo}
                              selected={selections[gameId] === 'home'}
                              onClick={() => pick(gameId, 'home')}
                            />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  )
}
