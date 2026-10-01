// Pulls the NFL schedule/scores straight from ESPN's public scoreboard API.
// Runs in the browser; falls back to a CORS proxy if the direct call is blocked.

function buildUrl(season, week) {
  return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&season=${season}`
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchWeekGames(season, week) {
  const url = buildUrl(season, week)
  let data
  try {
    data = await getJson(url)
  } catch {
    data = await getJson(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
  }

  const events = Array.isArray(data.events) ? data.events : []
  const realSeason = data.season?.year ?? season
  const realWeek = data.week?.number ?? week

  const games = []
  for (const event of events) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const away = comp.competitors?.find((c) => c.homeAway === 'away')
    const home = comp.competitors?.find((c) => c.homeAway === 'home')
    if (!away || !home) continue

    const completed = comp.status?.type?.completed === true
    const awayScore = parseInt(away.score) || 0
    const homeScore = parseInt(home.score) || 0
    const statusName = comp.status?.type?.name

    let status = 'scheduled'
    let winner = null
    if (completed) {
      status = 'final'
      winner = awayScore > homeScore ? 'away' : homeScore > awayScore ? 'home' : 'tie'
    } else if (statusName && statusName !== 'STATUS_SCHEDULED' && statusName !== 'Scheduled') {
      status = 'in_progress'
    }

    games.push({
      id: String(event.id),
      season: realSeason,
      week: realWeek,
      away_abbr: away.team.abbreviation,
      away_name: away.team.displayName,
      away_logo: away.team.logo || away.team.logos?.[0]?.href || '',
      home_abbr: home.team.abbreviation,
      home_name: home.team.displayName,
      home_logo: home.team.logo || home.team.logos?.[0]?.href || '',
      away_score: awayScore,
      home_score: homeScore,
      winner,
      status,
      game_date: event.date,
    })
  }
  return games
}
