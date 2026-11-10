import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const db = new DatabaseSync(fileURLToPath(new URL('./data.db', import.meta.url)));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, ext_id TEXT NOT NULL,
  name TEXT NOT NULL, short_name TEXT, league TEXT, country TEXT, badge TEXT,
  UNIQUE(source, ext_id)
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, ext_id TEXT NOT NULL,
  name TEXT NOT NULL, web_name TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  position TEXT NOT NULL CHECK (position IN ('GKP','DEF','MID','FWD')),
  nationality TEXT, birth_date TEXT,
  price REAL DEFAULT 0, total_points INTEGER DEFAULT 0, form REAL DEFAULT 0,
  selected_by REAL DEFAULT 0, goals INTEGER DEFAULT 0, assists INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0, minutes INTEGER DEFAULT 0,
  yellow INTEGER DEFAULT 0, red INTEGER DEFAULT 0,
  status TEXT DEFAULT 'a', news TEXT, photo TEXT, notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, ext_id)
);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_pos ON players(position);
CREATE TABLE IF NOT EXISTS squad (player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);

export const getMeta = k => db.prepare('SELECT value FROM meta WHERE key=?').get(k)?.value ?? null;
export const setMeta = (k, v) => db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
