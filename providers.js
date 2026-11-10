// Data providers. Each one returns { teams:[], players:[] } in the app's normalized shape.
// To add more leagues/countries later (API-Football, football-data.org, ...), add a provider here.
import { db, setMeta } from './db.js';

const POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const FPL_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';

export async function fetchFpl() {
  const res = await fetch(FPL_URL, { headers: { 'User-Agent': 'Mozilla/5.0 football-manager' } });
  if (!res.ok) throw new Error(`FPL API HTTP ${res.status}`);
  const d = await res.json();
  const teams = d.teams.map(t => ({
    ext_id: String(t.id), name: t.name, short_name: t.short_name,
    league: 'Premier League', country: 'England',
    badge: `https://resources.premierleague.com/premierleague/badges/70/t${t.code}.png`,
  }));
  const players = d.elements.map(e => ({
    ext_id: String(e.id), team_ext: String(e.team),
    name: `${e.first_name} ${e.second_name}`.trim(), web_name: e.web_name,
    position: POS[e.element_type],
    price: e.now_cost / 10, total_points: e.total_points, form: parseFloat(e.form) || 0,
    selected_by: parseFloat(e.selected_by_percent) || 0,
    goals: e.goals_scored, assists: e.assists, clean_sheets: e.clean_sheets,
    minutes: e.minutes, yellow: e.yellow_cards, red: e.red_cards,
    status: e.status, news: e.news || null,
    photo: `https://resources.premierleague.com/premierleague/photos/players/110x140/p${e.code}.png`,
  }));
  return { teams, players };
}

export function upsert(source, { teams, players }) {
  const upTeam = db.prepare(`INSERT INTO teams(source,ext_id,name,short_name,league,country,badge)
    VALUES(@source,@ext_id,@name,@short_name,@league,@country,@badge)
    ON CONFLICT(source,ext_id) DO UPDATE SET name=excluded.name, short_name=excluded.short_name,
    league=excluded.league, country=excluded.country, badge=excluded.badge`);
  const upPlayer = db.prepare(`INSERT INTO players(source,ext_id,name,web_name,team_id,position,nationality,birth_date,
      price,total_points,form,selected_by,goals,assists,clean_sheets,minutes,yellow,red,status,news,photo)
    VALUES(@source,@ext_id,@name,@web_name,@team_id,@position,@nationality,@birth_date,
      @price,@total_points,@form,@selected_by,@goals,@assists,@clean_sheets,@minutes,@yellow,@red,@status,@news,@photo)
    ON CONFLICT(source,ext_id) DO UPDATE SET name=excluded.name, web_name=excluded.web_name, team_id=excluded.team_id,
      position=excluded.position, price=excluded.price, total_points=excluded.total_points, form=excluded.form,
      selected_by=excluded.selected_by, goals=excluded.goals, assists=excluded.assists, clean_sheets=excluded.clean_sheets,
      minutes=excluded.minutes, yellow=excluded.yellow, red=excluded.red, status=excluded.status, news=excluded.news,
      photo=excluded.photo, updated_at=CURRENT_TIMESTAMP`);
  const teamId = db.prepare('SELECT id FROM teams WHERE source=? AND ext_id=?');
  const blank = { nationality: null, birth_date: null, news: null, photo: null, status: 'a',
    price: 0, total_points: 0, form: 0, selected_by: 0, goals: 0, assists: 0, clean_sheets: 0, minutes: 0, yellow: 0, red: 0 };
  db.exec('BEGIN');
  try {
    for (const t of teams) upTeam.run({ source, league: null, country: null, badge: null, short_name: null, ...t });
    for (const p of players) {
      const team_id = p.team_ext ? teamId.get(source, p.team_ext)?.id ?? null : null;
      const { team_ext, ...rest } = p;
      upPlayer.run({ ...blank, ...rest, source, team_id });
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { teams: teams.length, players: players.length };
}

export async function syncFpl() {
  const r = upsert('fpl', await fetchFpl());
  setMeta('last_sync_fpl', new Date().toISOString());
  return r;
}
