/**
 * CourtIQ Redux Store
 * Global app state: bet slip, bankroll, agent status, settings
 */
import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AgentStatus }   from '../services/BettingAgent';
import type { AgentSettings } from '../database/BetDatabase';
import { DEFAULT_SETTINGS }   from '../database/BetDatabase';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BetSlipItem {
  id:           string;
  player:       string;
  team:         string;
  statType:     string;
  line:         number;
  direction:    'OVER' | 'UNDER';
  odds:         number;
  confidence:   number;
  edgePct:      number;
  kellyPct:     number;
  grade:        'A' | 'B' | 'C' | 'D';
  projection:   number;
  stake:        number;
}

export interface AppState {
  // Bet slip (pre-placement)
  betSlip:       BetSlipItem[];

  // Bankroll
  bankroll:      number;

  // Agent
  agentStatus:   AgentStatus;
  agentMessage:  string;
  lastScanTime:  string | null;
  dailyBets:     number;
  dailyStaked:   number;
  dailyPnl:      number;

  // Settings (mirrors AgentSettings in DB)
  settings:      AgentSettings;

  // UI
  lastUpdated:   string | null;
}

const initialState: AppState = {
  betSlip:       [],
  bankroll:      DEFAULT_SETTINGS.bankroll,
  agentStatus:   'idle',
  agentMessage:  'Ready',
  lastScanTime:  null,
  dailyBets:     0,
  dailyStaked:   0,
  dailyPnl:      0,
  settings:      { ...DEFAULT_SETTINGS },
  lastUpdated:   null,
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // Bet slip
    addToBetSlip(state, action: PayloadAction<BetSlipItem>) {
      if (!state.betSlip.find(b => b.id === action.payload.id)) {
        state.betSlip.push(action.payload);
      }
    },
    removeFromBetSlip(state, action: PayloadAction<string>) {
      state.betSlip = state.betSlip.filter(b => b.id !== action.payload);
    },
    updateBetSlipStake(state, action: PayloadAction<{ id: string; stake: number }>) {
      const item = state.betSlip.find(b => b.id === action.payload.id);
      if (item) item.stake = action.payload.stake;
    },
    clearBetSlip(state) { state.betSlip = []; },

    // Bankroll
    setBankroll(state, action: PayloadAction<number>) {
      state.bankroll = action.payload;
    },
    adjustBankroll(state, action: PayloadAction<number>) {
      state.bankroll = Math.max(0, state.bankroll + action.payload);
    },

    // Agent state
    setAgentStatus(state, action: PayloadAction<AgentStatus>) {
      state.agentStatus = action.payload;
    },
    setAgentMessage(state, action: PayloadAction<string>) {
      state.agentMessage = action.payload;
    },
    setLastScanTime(state, action: PayloadAction<string>) {
      state.lastScanTime = action.payload;
    },
    incrementDailyBets(state, action: PayloadAction<{ staked: number; pnl?: number }>) {
      state.dailyBets   += 1;
      state.dailyStaked += action.payload.staked;
      if (action.payload.pnl !== undefined) state.dailyPnl += action.payload.pnl;
    },
    resetDailyStats(state) {
      state.dailyBets   = 0;
      state.dailyStaked = 0;
      state.dailyPnl    = 0;
    },

    // Settings
    setSettings(state, action: PayloadAction<Partial<AgentSettings>>) {
      state.settings = { ...state.settings, ...action.payload };
    },

    // Meta
    setLastUpdated(state, action: PayloadAction<string>) {
      state.lastUpdated = action.payload;
    },
  },
});

export const {
  addToBetSlip, removeFromBetSlip, updateBetSlipStake, clearBetSlip,
  setBankroll, adjustBankroll,
  setAgentStatus, setAgentMessage, setLastScanTime,
  incrementDailyBets, resetDailyStats,
  setSettings,
  setLastUpdated,
} = appSlice.actions;

// ── Store ─────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: { app: appSlice.reducer },
  middleware: getDefault => getDefault({ serializableCheck: false }),
});

export type RootState  = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
