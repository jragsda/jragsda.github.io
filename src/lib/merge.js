// Timestamp merge. Every record has an `updated_at` (ms). For records that exist
// on both sides the newer one wins; records that exist on only one side are kept.
// Ties are broken deterministically so every device converges on the same result.

const pickKey = (p) => `${p.player_id}|${p.game_id}`

export function stable(value) {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((o, k) => ((o[k] = v[k]), o), {})
      : v
  )
}

function mergeList(a = [], b = [], keyFn) {
  const map = new Map()
  for (const item of [...a, ...b]) {
    const k = keyFn(item)
    const old = map.get(k)
    if (!old) {
      map.set(k, item)
      continue
    }
    const ti = item.updated_at || 0
    const to = old.updated_at || 0
    if (ti > to || (ti === to && stable(item) > stable(old))) map.set(k, item)
  }
  return [...map.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([, v]) => v)
}

export function normalizeShared(s = {}) {
  return {
    players: mergeList(s.players, [], (x) => x.id),
    games: mergeList(s.games, [], (x) => x.id),
    picks: mergeList(s.picks, [], pickKey),
  }
}

export function mergeShared(local = {}, remote = {}) {
  return {
    players: mergeList(local.players, remote?.players, (x) => x.id),
    games: mergeList(local.games, remote?.games, (x) => x.id),
    picks: mergeList(local.picks, remote?.picks, pickKey),
  }
}

export const sharedOf = (d) => normalizeShared({ players: d.players, games: d.games, picks: d.picks })

export const stampMissing = (list = [], ts) => list.map((x) => (x.updated_at == null ? { ...x, updated_at: ts } : x))
