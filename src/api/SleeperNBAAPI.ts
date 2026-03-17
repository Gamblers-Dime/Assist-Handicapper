/**
 * Sleeper Fantasy API + NBA Stats API Service
 * Sleeper has a fully public, documented API — no key required.
 * NBA Stats (stats.nba.com) is public but requires proper headers.
 */

import axios from 'axios';

const SLEEPER_BASE  = 'https://api.sleeper.app/v1';
const NBA_STATS_BASE= 'https://stats.nba.com/stats';

// ─── SLEEPER SERVICE ─────────────────────────────────────────────────────────
export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  age: number | null;
  injury_status: string | null;
  stats?: SleeperPlayerStats;
}

export interface SleeperPlayerStats {
  ast: number;
  tov: number;
  pts: number;
  reb: number;
  min: number;
  gp: number;
}

export interface SleeperTrending {
  player_id: string;
  count: number;   // number of adds/drops in last 24h
}

class SleeperService {
  private playerCache: Record<string, SleeperPlayer> = {};
  private cacheTime   = 0;
  private CACHE_TTL   = 3600000; // 1 hour

  // ── All NBA players (position/team/injury) ────────────────────────────────
  async getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    const now = Date.now();
    if (Object.keys(this.playerCache).length && now - this.cacheTime < this.CACHE_TTL) {
      return this.playerCache;
    }
    try {
      const res = await axios.get(`${SLEEPER_BASE}/players/nba`, { timeout: 10000 });
      this.playerCache = res.data;
      this.cacheTime   = now;
      return res.data;
    } catch {
      return {};
    }
  }

  // ── Player stats for a given week ─────────────────────────────────────────
  async getPlayerStats(playerId: string, season = '2025', week = 1): Promise<SleeperPlayerStats | null> {
    try {
      const res = await axios.get(`${SLEEPER_BASE}/stats/nba/${season}/${week}`, { timeout: 8000 });
      return res.data[playerId] ?? null;
    } catch {
      return null;
    }
  }

  // ── Trending players (adds/drops) — injury indicator ─────────────────────
  async getTrending(type: 'add' | 'drop' = 'add', hours = 24, limit = 25): Promise<SleeperTrending[]> {
    try {
      const res = await axios.get(`${SLEEPER_BASE}/players/nba/trending/${type}`, {
        params: { lookback_hours: hours, limit },
        timeout: 5000,
      });
      return res.data;
    } catch {
      return [];
    }
  }

  // ── PG-specific injury detection (high drop rate = injury signal) ─────────
  async getPGInjurySignals(): Promise<Record<string, boolean>> {
    const trending = await this.getTrending('drop', 6, 50);
    const players  = await this.getAllPlayers();
    const signals: Record<string, boolean> = {};
    for (const t of trending) {
      const p = players[t.player_id];
      if (p?.position === 'PG' && t.count > 200) {
        signals[p.full_name] = true;
      }
    }
    return signals;
  }
}

// ─── NBA STATS SERVICE ───────────────────────────────────────────────────────
export interface NBAPlayerLog {
  gameDate: string;
  opponent: string;
  isHome: boolean;
  assists: number;
  turnovers: number;
  minutes: number;
  points: number;
  result: 'W' | 'L';
}

export interface NBADefenseStats {
  teamId: number;
  teamName: string;
  oppPGAstAllowed: number;    // avg assists allowed to PG position
  oppTOForced: number;        // avg turnovers forced
  defRating: number;
  stealPct: number;
  switchPct: number;
  pace: number;
}

class NBAStatsService {
  private headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Host': 'stats.nba.com',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:109.0)',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
  };

  // ── Player game log (last N games) ────────────────────────────────────────
  async getPlayerGameLog(playerId: number, season = '2025-26', last = 15): Promise<NBAPlayerLog[]> {
    try {
      const res = await axios.get(`${NBA_STATS_BASE}/playergamelog`, {
        headers: this.headers,
        params: {
          PlayerID: playerId,
          Season: season,
          SeasonType: 'Regular Season',
          LastNGames: last,
        },
        timeout: 10000,
      });

      const rows    = res.data.resultSets?.[0]?.rowSet ?? [];
      const headers = res.data.resultSets?.[0]?.headers ?? [];
      const idx     = (col: string) => headers.indexOf(col);

      return rows.map((r: any[]) => ({
        gameDate:  r[idx('GAME_DATE')],
        opponent:  r[idx('MATCHUP')].split(' ').pop(),
        isHome:    !r[idx('MATCHUP')].includes('@'),
        assists:   r[idx('AST')]   ?? 0,
        turnovers: r[idx('TOV')]   ?? 0,
        minutes:   parseFloat(r[idx('MIN')] ?? '0'),
        points:    r[idx('PTS')]   ?? 0,
        result:    r[idx('WL')],
      }));
    } catch {
      return [];
    }
  }

  // ── Team defense vs position (how well they defend PGs) ──────────────────
  async getDefenseVsPosition(position = 'PG', season = '2025-26'): Promise<NBADefenseStats[]> {
    try {
      const res = await axios.get(`${NBA_STATS_BASE}/leaguedashptteamdefend`, {
        headers: this.headers,
        params: {
          Season: season,
          SeasonType: 'Regular Season',
          PerMode: 'PerGame',
          DefenseCategory: position,
          DateFrom: '', DateTo: '',
        },
        timeout: 10000,
      });

      const rows    = res.data.resultSets?.[0]?.rowSet ?? [];
      const headers = res.data.resultSets?.[0]?.headers ?? [];
      const idx     = (col: string) => headers.indexOf(col);

      return rows.map((r: any[]) => ({
        teamId:           r[idx('TEAM_ID')],
        teamName:         r[idx('TEAM_NAME')],
        oppPGAstAllowed:  r[idx('AST_PG')] ?? 8.0,
        oppTOForced:      r[idx('TOV_PG')] ?? 2.8,
        defRating:        r[idx('DEF_RATING')] ?? 113.0,
        stealPct:         r[idx('STL_PCT')] ?? 0.018,
        switchPct:        0.42, // not in standard endpoint, use default
        pace:             r[idx('PACE')] ?? 100.8,
      }));
    } catch {
      return this.getMockDefenseStats();
    }
  }

  // ── League-wide pace and advanced team stats ──────────────────────────────
  async getTeamAdvancedStats(season = '2025-26'): Promise<Record<string, any>[]> {
    try {
      const res = await axios.get(`${NBA_STATS_BASE}/leaguedashteamstats`, {
        headers: this.headers,
        params: { Season: season, SeasonType: 'Regular Season', MeasureType: 'Advanced', PerMode: 'PerGame' },
        timeout: 10000,
      });
      return res.data.resultSets?.[0]?.rowSet ?? [];
    } catch {
      return [];
    }
  }

  getMockDefenseStats(): NBADefenseStats[] {
    return [
      { teamId: 1610612752, teamName: 'New York Knicks',         oppPGAstAllowed: 7.2, oppTOForced: 3.1, defRating: 108.9, stealPct: 0.022, switchPct: 0.68, pace: 98.6  },
      { teamId: 1610612749, teamName: 'Milwaukee Bucks',         oppPGAstAllowed: 8.1, oppTOForced: 2.8, defRating: 112.4, stealPct: 0.019, switchPct: 0.55, pace: 100.7 },
      { teamId: 1610612741, teamName: 'Chicago Bulls',           oppPGAstAllowed: 8.9, oppTOForced: 2.6, defRating: 115.2, stealPct: 0.016, switchPct: 0.42, pace: 101.2 },
      { teamId: 1610612748, teamName: 'Miami Heat',              oppPGAstAllowed: 7.8, oppTOForced: 2.9, defRating: 110.5, stealPct: 0.021, switchPct: 0.61, pace: 100.5 },
      { teamId: 1610612760, teamName: 'Oklahoma City Thunder',   oppPGAstAllowed: 7.1, oppTOForced: 3.3, defRating: 107.8, stealPct: 0.025, switchPct: 0.71, pace: 101.9 },
      { teamId: 1610612739, teamName: 'Cleveland Cavaliers',     oppPGAstAllowed: 7.4, oppTOForced: 3.0, defRating: 108.2, stealPct: 0.023, switchPct: 0.65, pace: 102.1 },
      { teamId: 1610612743, teamName: 'Denver Nuggets',          oppPGAstAllowed: 8.4, oppTOForced: 2.7, defRating: 113.1, stealPct: 0.017, switchPct: 0.38, pace: 100.3 },
      { teamId: 1610612761, teamName: 'Toronto Raptors',         oppPGAstAllowed: 8.2, oppTOForced: 2.9, defRating: 114.3, stealPct: 0.018, switchPct: 0.45, pace: 102.8 },
    ];
  }
}

export const sleeperService  = new SleeperService();
export const nbaStatsService = new NBAStatsService();
