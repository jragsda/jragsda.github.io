import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAppState } from '@/lib/AppState';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { GripVertical, Save } from 'lucide-react';
import TeamBadge from '@/components/TeamBadge';

export default function Picks() {
  const { season, week, games, currentPlayer, currentPlayerId, loading } = useAppState();
  const { toast } = useToast();
  const [order, setOrder] = useState([]);
  const [selections, setSelections] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentPlayerId || !games.length) {
      setOrder(games.map((g) => g.id));
      setSelections({});
      return;
    }
    let active = true;
    base44.entities.Pick.filter({ player_id: currentPlayerId, season, week }).then((picks) => {
      if (!active) return;
      const sel = {};
      const conf = {};
      picks.forEach((p) => {
        sel[p.game_id] = p.picked_team;
        conf[p.game_id] = p.confidence;
      });
      const sorted = [...games].sort((a, b) => (conf[a.id] ?? 999) - (conf[b.id] ?? 999));
      setOrder(sorted.map((g) => g.id));
      setSelections(sel);
    });
    return () => {
      active = false;
    };
  }, [currentPlayerId, season, week, games]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(order);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setOrder(items);
  };

  const pick = (gameId, team) => {
    setSelections((s) => ({ ...s, [gameId]: s[gameId] === team ? null : team }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Pick.deleteMany({ player_id: currentPlayerId, season, week });
      const newPicks = order.map((gameId, i) => ({
        player_id: currentPlayerId,
        game_id: gameId,
        season,
        week,
        picked_team: selections[gameId] || null,
        confidence: 16 - i,
      }));
      if (newPicks.length) await base44.entities.Pick.bulkCreate(newPicks);
      toast({ title: 'Picks saved' });
    } finally {
      setSaving(false);
    }
  };

  if (!currentPlayer) return <div className="text-muted-foreground">Add players first.</div>;

  const minConf = games.length ? 16 - games.length + 1 : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Picks — {currentPlayer.name}</h1>
          <p className="text-sm text-muted-foreground">
            Drag to rank confidence ({16} → {minConf}). Click a team to pick the winner.
          </p>
        </div>
        <Button onClick={save} disabled={saving || !games.length}>
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Picks'}
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
                  const game = games.find((g) => g.id === gameId);
                  if (!game) return null;
                  const conf = 16 - index;
                  return (
                    <Draggable key={gameId} draggableId={gameId} index={index}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className="flex items-center gap-3 rounded-xl border bg-card p-3"
                        >
                          <div {...prov.dragHandleProps} className="cursor-grab text-muted-foreground">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
                            {conf}
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
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}