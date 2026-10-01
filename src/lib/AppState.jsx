import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { fetchWeekGames } from '@/lib/espn'
import { auth, firestore, firebaseConfigured } from '@/lib/firebase'

const STORAGE_KEY = 'nfl-confidence-pool-v1'

const DEFAULT_DB = {
  season: 2026,
  week: 4,
  players: [
    { id: 'p1', name: 'Player 1' },
    { id: 'p2', name: 'Player 2' },
  ],
  currentPlayerId: 'p1',
  games: [],
  picks: [],
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_DB, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_DB
}

const AppStateContext = createContext(null)

export function AppStateProvider({ children }) {
  const [db, setDb] = useState(loadDb)
  const [loading, setLoading] = useState(false)
  const [syncUser, setSyncUser] = useState(null)
  const fetchedRef = useRef(new Set())
  const cloudReadyRef = useRef(false)
  const applyingCloudRef = useRef(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)) } catch {}
  }, [db])

  useEffect(() => {
    if (!auth) return
    return auth.onAuthStateChanged(async (user) => {
      setSyncUser(user)
      cloudReadyRef.current = false
      if (!user) return

      try {
        const ref = firestore.collection('users').doc(user.uid)
        const snap = await ref.get()
        if (snap.exists) {
          applyingCloudRef.current = true
          const cloud = snap.data()
          setDb((prev) => ({
            ...prev,
            season: cloud.season ?? prev.season,
            week: cloud.week ?? prev.week,
            players: Array.isArray(cloud.players) ? cloud.players : prev.players,
            currentPlayerId: cloud.currentPlayerId ?? prev.currentPlayerId,
            picks: Array.isArray(cloud.picks) ? cloud.picks : prev.picks,
          }))
          setTimeout(() => { applyingCloudRef.current = false }, 0)
        }
        cloudReadyRef.current = true
        toast.success('Picks synced')
      } catch (e) {
        console.error(e)
        toast.error('Could not load cloud picks')
        cloudReadyRef.current = true
      }
    })
  }, [])

  useEffect(() => {
    if (!syncUser || !firebaseConfigured || !cloudReadyRef.current || applyingCloudRef.current) return
    const timer = setTimeout(() => {
      firestore.collection('users').doc(syncUser.uid).set({
        season: db.season,
        week: db.week,
        players: db.players,
        currentPlayerId: db.currentPlayerId,
        picks: db.picks,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch((e) => {
        console.error(e)
        toast.error('Cloud sync failed')
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [db.season, db.week, db.players, db.currentPlayerId, db.picks, syncUser])

  const { season, week, players, currentPlayerId } = db

  const games = useMemo(
    () => db.games
      .filter((g) => g.season === season && g.week === week)
      .sort((a, b) => String(a.game_date).localeCompare(String(b.game_date))),
    [db.games, season, week]
  )

  const refresh = useCallback(async ({ silent = false } = {}) => {
    setLoading(true)
    try {
      const incoming = await fetchWeekGames(season, week)
      setDb((prev) => {
        const byId = new Map(prev.games.map((g) => [g.id, g]))
        for (const g of incoming) {
          const old = byId.get(g.id)
          if (old && old.status === 'final' && g.status !== 'final') continue
          byId.set(g.id, { ...old, ...g })
        }
        return { ...prev, games: [...byId.values()] }
      })
      if (!silent) toast.success(incoming.length ? 'Scores updated' : 'No games found for this week')
    } catch (e) {
      console.error(e)
      if (!silent) toast.error("Couldn't reach ESPN — try again in a moment")
    } finally {
      setLoading(false)
    }
  }, [season, week])

  useEffect(() => {
    const key = season + '-' + week
    if (fetchedRef.current.has(key)) return
    fetchedRef.current.add(key)
    if (!db.games.some((g) => g.season === season && g.week === week)) refresh({ silent: true })
  }, [season, week, refresh])

  const changeWeek = (w) => setDb((p) => ({ ...p, week: w }))
  const setCurrentPlayerId = (id) => setDb((p) => ({ ...p, currentPlayerId: id }))
  const renamePlayer = (id, name) =>
    setDb((p) => ({ ...p, players: p.players.map((pl) => (pl.id === id ? { ...pl, name } : pl)) }))

  const updateGame = (id, patch) =>
    setDb((p) => ({ ...p, games: p.games.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))

  const savePicks = (playerId, newPicks) =>
    setDb((p) => ({
      ...p,
      picks: [
        ...p.picks.filter((pk) => !(pk.player_id === playerId && pk.season === p.season && pk.week === p.week)),
        ...newPicks,
      ],
    }))

  const exportData = () => JSON.stringify(db, null, 2)
  const importData = (text) => {
    const parsed = JSON.parse(text)
    if (!parsed || !Array.isArray(parsed.games) || !Array.isArray(parsed.picks)) throw new Error('Not a pool backup')
    setDb({ ...DEFAULT_DB, ...parsed })
  }

  const currentPlayer = players.find((p) => p.id === currentPlayerId) || players[0]

  return (
    <AppStateContext.Provider value={{
      season,
      week,
      players,
      currentPlayerId: currentPlayer?.id,
      currentPlayer,
      setCurrentPlayerId,
      renamePlayer,
      games,
      allGames: db.games,
      allPicks: db.picks,
      loading,
      refresh,
      changeWeek,
      updateGame,
      savePicks,
      exportData,
      importData,
      syncUser,
      syncConfigured: firebaseConfigured,
    }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}

export default AppStateProvider
