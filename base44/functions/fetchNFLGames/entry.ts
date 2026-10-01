import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (e) {}

    const week = body.week;
    const season = body.season;
    const seasonYear = season ?? new Date().getFullYear();
    const weekNum = week ?? 1;

    let url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
    if (week && season) url += `?seasontype=2&week=${week}&season=${season}`;

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.espn.com/',
    };

    let data = null;
    try {
      let res = await fetch(url, { headers });
      if (!res.ok) {
        const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        res = await fetch(proxied, { headers });
      }
      if (res.ok) data = await res.json();
    } catch (e) {
      /* fall through to DB */
    }

    if (!data) {
      // ESPN unreachable from this runtime; return the seeded games for the week
      const existing = await base44.asServiceRole.entities.Game.filter({ season: seasonYear, week: weekNum });
      return Response.json({ season: seasonYear, week: weekNum, games: existing, stale: true });
    }

    const realSeason = data.season?.year ?? seasonYear;
    const realWeek = data.week?.number ?? data.week ?? weekNum;
    const events = Array.isArray(data.events) ? data.events : [];

    const existing = await base44.asServiceRole.entities.Game.filter({ season: realSeason, week: realWeek });
    const byEspn = {};
    for (const g of existing) byEspn[g.espn_id] = g;

    const games = [];
    for (const event of events) {
      const comp = event.competitions && event.competitions[0];
      if (!comp) continue;
      const competitors = comp.competitors || [];
      const away = competitors.find((c) => c.homeAway === 'away');
      const home = competitors.find((c) => c.homeAway === 'home');
      if (!away || !home) continue;

      const completed = comp.status?.type?.completed === true;
      const awayScore = parseInt(away.score) || 0;
      const homeScore = parseInt(home.score) || 0;
      let winner = null;
      let status = 'scheduled';
      const statusName = comp.status?.type?.name;
      if (completed) {
        status = 'final';
        if (awayScore > homeScore) winner = 'away';
        else if (homeScore > awayScore) winner = 'home';
        else winner = 'tie';
      } else if (statusName && statusName !== 'Scheduled') {
        status = 'in_progress';
      }

      const payload = {
        season: realSeason,
        week: realWeek,
        espn_id: event.id,
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
      };

      if (byEspn[event.id]) {
        const updated = await base44.asServiceRole.entities.Game.update(byEspn[event.id].id, payload);
        games.push(updated);
      } else {
        const created = await base44.asServiceRole.entities.Game.create(payload);
        games.push(created);
      }
    }

    return Response.json({ season: realSeason, week: realWeek, games });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}