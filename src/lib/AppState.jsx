import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [season, setSeason] = useState(2026);
  const [week, setWeek] = useState(4);
  const [players, setPlayers] = useState([]);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.Player.list().then(setPlayers).catch(() => {});
  }, []);

  useEffect(() => {
    if (players.length && !currentPlayerId) setCurrentPlayerId(players[0].id);
  }, [players, currentPlayerId]);

  const loadGames = useCallback(async (s, w) => {
    try {
      const list = await base44.entities.Game.filter({ season: s, week: w }, 'game_date');
      setGames(list);
    } catch (e) {
      console.error('loadGames error', e);
    }
  }, []);

  useEffect(() => {
    loadGames(season, week);
  }, [season, week, loadGames]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // best-effort live pull from ESPN (may be blocked by the runtime); reload from DB either way
      await base44.functions.invoke('fetchNflGames', { week, season });
    } catch (e) {
      /* ignore — games are seeded in the database */
    }
    await loadGames(season, week);
    setLoading(false);
  }, [week, season, loadGames]);

  const changeWeek = (w) => setWeek(w);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  return (
    <AppStateContext.Provider
      value={{
        season,
        week,
        players,
        currentPlayerId,
        setCurrentPlayerId,
        currentPlayer,
        games,
        loading,
        refresh,
        changeWeek,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export default AppStateProvider;