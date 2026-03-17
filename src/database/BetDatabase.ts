/**
 * CourtIQ Bet Database
 * SQLite-backed persistence for bets, bankroll, and settings.
 *
 * Schema:
 *  bets            — placed bets with outcome tracking
 *  bankroll_log    — bankroll snapshots over time
 *  agent_settings  — key/value config for the betting agent
 *
 * React Native uses `react-native-sqlite-storage`.
 * In the test/Node environment a JSON file fallback is used.
 */

import { Platform } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BetRecord {
  id:           string;
  timestamp:    string;          // ISO 8601
  player:       string;
  team:         string;
  opponent:     string;
  statType:     'ASSISTS' | 'TURNOVERS' | 'POINTS' | 'PRA';
  line:         number;
  direction:    'OVER' | 'UNDER';
  odds:         number;          // American odds
  stake:        number;          // USD
  confidence:   number;          // 0–100
  edgePct:      number;
  kellyPct:     number;
  grade:        'A' | 'B' | 'C' | 'D';
  projection:   number;
  gameId:       string;
  bookmaker:    string;
  // Post-game resolution
  status:       'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'CANCELLED';
  actualResult: number | null;   // actual stat line
  pnl:          number | null;   // profit/loss in USD
  settledAt:    string | null;
}

export interface BankrollLog {
  id:        string;
  timestamp: string;
  balance:   number;
  delta:     number;
  reason:    string;
}

export interface AgentSettings {
  bankroll:           number;    // starting bankroll
  maxDailyExposure:   number;    // max $ per day
  maxSingleBet:       number;    // max $ per bet
  minConfidence:      number;    // min % confidence
  minEdgePct:         number;    // min edge %
  gradesAllowed:      string;    // comma-separated: "A,B"
  oddsApiKey:         string;
  autoPlaceBets:      boolean;
  responsibleGamblingLimit: number; // loss limit before agent pauses
  agentEnabled:       boolean;
}

export const DEFAULT_SETTINGS: AgentSettings = {
  bankroll:                  1000,
  maxDailyExposure:          500,
  maxSingleBet:              100,
  minConfidence:             70,
  minEdgePct:                4,
  gradesAllowed:             'A,B',
  oddsApiKey:                '',
  autoPlaceBets:             false,   // must be explicitly enabled
  responsibleGamblingLimit:  200,
  agentEnabled:              false,
};

// ── Adapter interface (platform-specific implementations) ────────────────────
interface DBAdapter {
  init():                                                         Promise<void>;
  run(sql: string, params?: any[]):                               Promise<void>;
  get<T>(sql: string, params?: any[]):                            Promise<T | null>;
  all<T>(sql: string, params?: any[]):                            Promise<T[]>;
}

// ── AsyncStorage-based adapter (React Native, no native module) ───────────────
class AsyncStorageAdapter implements DBAdapter {
  private store: Record<string, any> = {};
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    try {
      const { default: AsyncStorage } = await import(
        '@react-native-async-storage/async-storage'
      );
      const raw = await AsyncStorage.getItem('courtiq_db');
      if (raw) this.store = JSON.parse(raw);
    } catch {
      this.store = {};
    }
    this.loaded = true;
  }

  private async save() {
    try {
      const { default: AsyncStorage } = await import(
        '@react-native-async-storage/async-storage'
      );
      await AsyncStorage.setItem('courtiq_db', JSON.stringify(this.store));
    } catch (e) {
      console.warn('[DB] AsyncStorage save failed:', e);
    }
  }

  async init() {
    await this.load();
    if (!this.store.bets)          this.store.bets = [];
    if (!this.store.bankroll_log)  this.store.bankroll_log = [];
    if (!this.store.settings)      this.store.settings = { ...DEFAULT_SETTINGS };
    await this.save();
  }

  // Simplified SQL-to-store mapping
  async run(sql: string, params: any[] = []) {
    await this.load();
    const s = sql.trim().toUpperCase();

    if (s.startsWith('INSERT INTO BETS')) {
      const bet = params[0] as BetRecord;
      this.store.bets.push(bet);
    } else if (s.startsWith('UPDATE BETS SET STATUS')) {
      const [status, pnl, actual, settledAt, id] = params;
      const bet = this.store.bets.find((b: BetRecord) => b.id === id);
      if (bet) { bet.status = status; bet.pnl = pnl; bet.actualResult = actual; bet.settledAt = settledAt; }
    } else if (s.startsWith('INSERT INTO BANKROLL_LOG')) {
      const log = params[0] as BankrollLog;
      this.store.bankroll_log.push(log);
    } else if (s.startsWith('UPDATE SETTINGS')) {
      const settings = params[0] as Partial<AgentSettings>;
      this.store.settings = { ...this.store.settings, ...settings };
    } else if (s.startsWith('DELETE FROM BETS WHERE ID')) {
      this.store.bets = this.store.bets.filter((b: BetRecord) => b.id !== params[0]);
    }

    await this.save();
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    await this.load();
    const s = sql.trim().toUpperCase();

    if (s.includes('FROM BETS WHERE ID')) {
      return (this.store.bets.find((b: BetRecord) => b.id === params[0]) ?? null) as T | null;
    }
    if (s.includes('FROM SETTINGS')) {
      return (this.store.settings ?? null) as T | null;
    }
    if (s.includes('SUM(STAKE) FROM BETS WHERE DATE')) {
      const date = params[0] as string;
      const total = this.store.bets
        .filter((b: BetRecord) => b.timestamp.startsWith(date) && b.status === 'PENDING')
        .reduce((sum: number, b: BetRecord) => sum + b.stake, 0);
      return ({ total } as unknown) as T;
    }
    return null;
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.load();
    const s = sql.trim().toUpperCase();

    if (s.includes('FROM BETS')) {
      let rows = [...this.store.bets] as BetRecord[];
      if (s.includes('WHERE STATUS = ?') && params[0]) {
        rows = rows.filter(b => b.status === params[0]);
      }
      if (s.includes('ORDER BY TIMESTAMP DESC')) {
        rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      }
      if (s.includes('LIMIT')) {
        const limit = parseInt(sql.match(/LIMIT (\d+)/i)?.[1] ?? '100');
        rows = rows.slice(0, limit);
      }
      return rows as unknown as T[];
    }
    if (s.includes('FROM BANKROLL_LOG')) {
      return ([...this.store.bankroll_log].sort(
        (a: BankrollLog, b: BankrollLog) => b.timestamp.localeCompare(a.timestamp)
      ).slice(0, 50)) as unknown as T[];
    }
    return [];
  }
}

// ── High-level database API ───────────────────────────────────────────────────
class BetDatabase {
  private db: DBAdapter;
  private initialized = false;

  constructor() {
    // AsyncStorage adapter works in React Native and Node test environments
    this.db = new AsyncStorageAdapter();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.db.init();
    this.initialized = true;
  }

  // ── Bets ──────────────────────────────────────────────────────────────────
  async insertBet(bet: BetRecord): Promise<void> {
    await this.init();
    await this.db.run('INSERT INTO bets', [bet]);
  }

  async settleBet(id: string, status: BetRecord['status'], actualResult: number, pnl: number): Promise<void> {
    await this.init();
    await this.db.run(
      'UPDATE bets SET status = ?, pnl = ?, actualResult = ?, settledAt = ?  WHERE id = ?',
      [status, pnl, actualResult, new Date().toISOString(), id]
    );
  }

  async getPendingBets(): Promise<BetRecord[]> {
    await this.init();
    return this.db.all<BetRecord>('SELECT * FROM bets WHERE status = ? ORDER BY timestamp DESC', ['PENDING']);
  }

  async getSettledBets(limit = 50): Promise<BetRecord[]> {
    await this.init();
    return this.db.all<BetRecord>(`SELECT * FROM bets WHERE status != 'PENDING' ORDER BY timestamp DESC LIMIT ${limit}`);
  }

  async getAllBets(limit = 200): Promise<BetRecord[]> {
    await this.init();
    return this.db.all<BetRecord>(`SELECT * FROM bets ORDER BY timestamp DESC LIMIT ${limit}`);
  }

  async getDailyExposure(dateStr: string): Promise<number> {
    await this.init();
    const row = await this.db.get<{ total: number }>(
      "SELECT SUM(stake) FROM bets WHERE DATE(timestamp) = ?",
      [dateStr]
    );
    return row?.total ?? 0;
  }

  // ── Bankroll ──────────────────────────────────────────────────────────────
  async getBankroll(): Promise<number> {
    await this.init();
    const settings = await this.db.get<AgentSettings>('SELECT * FROM settings');
    return settings?.bankroll ?? DEFAULT_SETTINGS.bankroll;
  }

  async updateBankroll(newBalance: number, delta: number, reason: string): Promise<void> {
    await this.init();
    const log: BankrollLog = {
      id:        `bl_${Date.now()}`,
      timestamp: new Date().toISOString(),
      balance:   newBalance,
      delta,
      reason,
    };
    await this.db.run('INSERT INTO bankroll_log', [log]);
    await this.db.run('UPDATE settings', [{ bankroll: newBalance }]);
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings(): Promise<AgentSettings> {
    await this.init();
    const s = await this.db.get<AgentSettings>('SELECT * FROM settings');
    return s ?? { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: Partial<AgentSettings>): Promise<void> {
    await this.init();
    await this.db.run('UPDATE settings', [settings]);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  async getPerformanceSummary(): Promise<{
    totalBets:  number;
    wins:       number;
    losses:     number;
    pushes:     number;
    winRate:    number;
    totalPnl:   number;
    roi:        number;
    gradeAWins: number;
    gradeABets: number;
  }> {
    await this.init();
    const settled = await this.getSettledBets(500);
    const wins    = settled.filter(b => b.status === 'WON').length;
    const losses  = settled.filter(b => b.status === 'LOST').length;
    const pushes  = settled.filter(b => b.status === 'PUSH').length;
    const pnl     = settled.reduce((sum, b) => sum + (b.pnl ?? 0), 0);
    const staked  = settled.reduce((sum, b) => sum + b.stake, 0);
    const gradeA  = settled.filter(b => b.grade === 'A');
    return {
      totalBets:  settled.length,
      wins,
      losses,
      pushes,
      winRate:    wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      totalPnl:   Math.round(pnl * 100) / 100,
      roi:        staked > 0 ? Math.round((pnl / staked) * 10000) / 100 : 0,
      gradeABets: gradeA.length,
      gradeAWins: gradeA.filter(b => b.status === 'WON').length,
    };
  }
}

export const betDatabase = new BetDatabase();
export default BetDatabase;
