import React, { useEffect, useState } from 'react';
import { useAppState } from '@/lib/AppState';
import { base44 } from '@/api/base44Client';
import { Check, X, Trophy } from 'lucide-react';

function scorePlayer(games, picks, playerId) {
  let points = 0;
  let right = 0;
  let wrong = 0;
  let pending = 0;
  for (const game of games) {
    const pick = picks.find((p) => p.player_id === playerId && p.game_id === game.id);
    if (!game.winner || game.status !== 'final' || game.winner === 'tie') {
      pending++;
      continue;
    }
    if (!pick || !pick.picked_team) {
      wrong++;
      continue;
    }
    if (pick.picked_team === game.winner) {
      points += pick.confidence;
      right++;
    } else {
      wrong++;
    }
  }
  return { points, right, wrong, pending };
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
  );
}

export default function Dashboard() {
  const { season, week, games, players } = useAppState();
  const [weekPicks, setWeekPicks] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [allPicks, setAllPicks] = useState([]);

  useEffect(() => {
    base44.entities.Pick.filter({ season, week }).then(setWeekPicks).catch(() => {});
  }, [season, week, games]);

  useEffect(() => {
    base44.entities.Game.list('-updated_date', 500).then(setAllGames).catch(() => {});
    base44.entities.Pick.list('-updated_date', 1000).then(setAllPicks).catch(() => {});
  }, [season, week, games]);

  const weekScores = players.map((p) => ({ player: p, ...scorePlayer(games, weekPicks, p.id) }));
  const overallScores = players.map((p) => ({ player: p, ...scorePlayer(allGames, allPicks, p.id) }));

  const leader =
    overallScores.length === 2
      ? overallScores[0].points > overallScores[1].points
        ? overallScores[0]
        : overallScores[1].points > overallScores[0].points
        ? overallScores[1]
        : null
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Season {season} · Week {week}</p>
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
          {weekScores.map(({ player, points, right, wrong, pending }) => (
            <ScoreCard
              key={player.id}
              player={player}
              points={points}
              right={right}
              wrong={wrong}
              pending={pending}
              showPending
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading font-semibold mb-3">Season Totals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overallScores.map(({ player, points, right, wrong }) => (
            <ScoreCard key={player.id} player={player} points={points} right={right} wrong={wrong} pending={0} />
          ))}
        </div>
      </section>
    </div>
  );
}