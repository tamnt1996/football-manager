// Small demo set of well-known players from several leagues so the app is usable offline.
// Stats are intentionally zero – these are placeholders you can edit or replace by import/sync.
import { db } from './db.js';
import { upsert } from './providers.js';

const T = (id, name, short, league, country) => ({ ext_id: id, name, short_name: short, league, country, badge: null });
const P = (id, name, web, team, pos, nat, price) => ({ ext_id: id, team_ext: team, name, web_name: web, position: pos, nationality: nat, price });

export function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) c FROM players').get().c > 0) return false;
  upsert('demo', {
    teams: [
      T('rma', 'Real Madrid', 'RMA', 'La Liga', 'Spain'), T('bar', 'FC Barcelona', 'BAR', 'La Liga', 'Spain'),
      T('mci', 'Manchester City', 'MCI', 'Premier League', 'England'), T('liv', 'Liverpool', 'LIV', 'Premier League', 'England'),
      T('bay', 'Bayern Munich', 'BAY', 'Bundesliga', 'Germany'), T('psg', 'Paris Saint-Germain', 'PSG', 'Ligue 1', 'France'),
      T('int', 'Inter Milan', 'INT', 'Serie A', 'Italy'), T('hil', 'Al-Hilal', 'HIL', 'Saudi Pro League', 'Saudi Arabia'),
    ],
    players: [
      P('1', 'Kylian Mbappé', 'Mbappé', 'rma', 'FWD', 'France', 14.5), P('2', 'Vinícius Júnior', 'Vinícius Jr', 'rma', 'FWD', 'Brazil', 13.5),
      P('3', 'Jude Bellingham', 'Bellingham', 'rma', 'MID', 'England', 11.5), P('4', 'Thibaut Courtois', 'Courtois', 'rma', 'GKP', 'Belgium', 5.5),
      P('5', 'Lamine Yamal', 'Yamal', 'bar', 'FWD', 'Spain', 10.5), P('6', 'Pedri', 'Pedri', 'bar', 'MID', 'Spain', 8.5),
      P('7', 'Robert Lewandowski', 'Lewandowski', 'bar', 'FWD', 'Poland', 9.0), P('8', 'Erling Haaland', 'Haaland', 'mci', 'FWD', 'Norway', 15.0),
      P('9', 'Rodri', 'Rodri', 'mci', 'MID', 'Spain', 9.0), P('10', 'Rúben Dias', 'Dias', 'mci', 'DEF', 'Portugal', 6.0),
      P('11', 'Mohamed Salah', 'Salah', 'liv', 'MID', 'Egypt', 13.0), P('12', 'Virgil van Dijk', 'Van Dijk', 'liv', 'DEF', 'Netherlands', 6.0),
      P('13', 'Alisson Becker', 'Alisson', 'liv', 'GKP', 'Brazil', 5.5), P('14', 'Harry Kane', 'Kane', 'bay', 'FWD', 'England', 11.0),
      P('15', 'Jamal Musiala', 'Musiala', 'bay', 'MID', 'Germany', 9.0), P('16', 'Manuel Neuer', 'Neuer', 'bay', 'GKP', 'Germany', 5.0),
      P('17', 'Ousmane Dembélé', 'Dembélé', 'psg', 'FWD', 'France', 9.5), P('18', 'Achraf Hakimi', 'Hakimi', 'psg', 'DEF', 'Morocco', 6.5),
      P('19', 'Lautaro Martínez', 'Lautaro', 'int', 'FWD', 'Argentina', 10.0), P('20', 'Nicolò Barella', 'Barella', 'int', 'MID', 'Italy', 7.5),
      P('21', 'Alessandro Bastoni', 'Bastoni', 'int', 'DEF', 'Italy', 5.5), P('22', 'Neymar Jr', 'Neymar', 'hil', 'FWD', 'Brazil', 9.0),
      P('23', 'Kalidou Koulibaly', 'Koulibaly', 'hil', 'DEF', 'Senegal', 5.0), P('24', 'Yassine Bounou', 'Bono', 'hil', 'GKP', 'Morocco', 5.0),
    ],
  });
  return true;
}
