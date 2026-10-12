import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { fetchWeekGames } from '@/lib/espn'
import { auth, firestore, firebaseConfigured, POOL_ID } from '@/lib/firebase'
import { mergeShared, normalizeShared, sharedOf, stable, stampMissing } from '@/lib/merge'

const STORAGE_KEY = 'nfl-confidence-pool-v1'

const DEFAULT_DB = {
  season: 2026,
  week: 4,
  players: [
    { id: 'p1', name: 'Player 1', updated_at: 0 },
    { id: 'p2', name: 'Player 2', updated_at: 0 },
  ],
  currentPlayerId: 'p1',
  games: [],
  picks: [],
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = { ...DEFAULT_DB, ...JSON.parse(raw) }
      const now = Date.now()
      return { ...d, players: stampMissing(d.players, now), games: stampMissing(d.games, now), picks: stampMissing(d.picks, now) }
    }
  } catch {}
  return DEFAULT_DB
}

const AppStateContext = createContext(null)

export function AppStateProvider({ children }) {
  const [db, setDb] = useState(loadDb)
  const [loading, setLoading] = useState(false)
  const [syncUser, setSyncUser] = useState(null)
  const fetchedRef = useRef(new Set())
  const [cloudLoaded, setCloudLoaded] = useState(false)
  const remoteRef = useRef(null)
  const dbRef = useRef(db)
  dbRef.current = db

  // 1) Save to this browser — merged with whatever is already stored, so a stale
  //    tab can never overwrite newer picks saved from another tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      let toWrite = db
      if (raw) toWrite = { ...db, ...mergeShared(sharedOf(db), sharedOf(JSON.parse(raw))) }
      const out = JSON.stringify(toWrite)
      if (out !== raw) localStorage.setItem(STORAGE_KEY, out)
    } catch {}
  }, [db])

  // 2) Pick up changes made in other tabs of this browser.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const other = JSON.parse(e.newValue)
        setDb((prev) => {
          const merged = mergeShared(sharedOf(prev), sharedOf(other))
          return stable(merged) === stable(sharedOf(prev)) ? prev : { ...prev, ...merged }
        })
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 3) Cloud sync: ONE shared document, merged by timestamp in both directions.
  useEffect(() => {
    if (!auth) return
    return auth.onAuthStateChanged((user) => setSyncUser(user))
  }, [])

  const poolRef = useCallback(() => firestore.collection('pools').doc(POOL_ID), [])

  // live listener: merge whatever the cloud has into this device
  useEffect(() => {
    if (!syncUser || !firebaseConfigured) return
    let cancelled = false
    setCloudLoaded(false)

    // one-time: fold in picks from the old per-user document (oldest timestamp, so they never beat newer data)
    firestore.collection('users').doc(syncUser.uid).get().then((snap) => {
      if (cancelled || !snap.exists) return
      const old = snap.data()
      const legacy = {
        players: stampMissing(Array.isArray(old.players) ? old.players : [], 1),
        picks: stampMissing(Array.isArray(old.picks) ? old.picks : [], 1),
      }
      setDb((prev) => ({ ...prev, ...mergeShared(sharedOf(prev), legacy) }))
    }).catch(() => {})

    const unsub = poolRef().onSnapshot(
      (snap) => {
        const remote = snap.exists ? snap.data() : {}
        remoteRef.current = normalizeShared(remote)
        setDb((prev) => {
          const merged = mergeShared(sharedOf(prev), remote)
          return stable(merged) === stable(sharedOf(prev)) ? prev : { ...prev, ...merged }
        })
        setCloudLoaded(true)
      },
      (e) => {
        console.error(e)
        toast.error('Cloud sync blocked — is your email allowed in the Firestore rules?')
      }
    )
    return () => {
      cancelled = true
      unsub()
    }
  }, [syncUser, poolRef])

  // push: whenever local data differs from the cloud, merge-and-write inside a transaction
  useEffect(() => {
    if (!syncUser || !firebaseConfigured || !cloudLoaded) return
    if (stable(sharedOf(db)) === stable(remoteRef.current)) return
    const timer = setTimeout(async () => {
      try {
        await firestore.runTransaction(async (tx) => {
          const snap = await tx.get(poolRef())
          const merged = mergeShared(sharedOf(dbRef.current), snap.exists ? snap.data() : {})
          tx.set(poolRef(), { ...merged, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() })
        })
      } catch (e) {
        console.error(e)
        toast.error('Cloud sync failed')
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [db, syncUser, cloudLoaded, poolRef])

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
          const changed = !old || Object.keys(g).some((k) => g[k] !== old[k])
          byId.set(g.id, changed ? { ...old, ...g, updated_at: Date.now() } : old)
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
    setDb((p) => ({ ...p, players: p.players.map((pl) => (pl.id === id ? { ...pl, name, updated_at: Date.now() } : pl)) }))

  const updateGame = (id, patch) =>
    setDb((p) => ({ ...p, games: p.games.map((g) => (g.id === id ? { ...g, ...patch, updated_at: Date.now() } : g)) }))

  const savePicks = (playerId, newPicks) =>
    setDb((p) => ({
      ...p,
      picks: [
        ...p.picks.filter((pk) => !(pk.player_id === playerId && pk.season === p.season && pk.week === p.week)),
        ...newPicks.map((pk) => ({ ...pk, updated_at: Date.now() })),
      ],
    }))

  const exportData = () => JSON.stringify(db, null, 2)
  const importData = (text) => {
    const parsed = JSON.parse(text)
    if (!parsed || !Array.isArray(parsed.games) || !Array.isArray(parsed.picks)) throw new Error('Not a pool backup')
    const now = Date.now()
    setDb({ ...DEFAULT_DB, ...parsed, players: stampMissing(parsed.players || DEFAULT_DB.players, now), games: stampMissing(parsed.games, now), picks: stampMissing(parsed.picks, now) })
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
