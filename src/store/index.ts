import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BetSlipItem {
  id: string;
  player: string;
  prop: string;
  line: number;
  direction: 'OVER' | 'UNDER';
  odds: number;
  confidence: number;
  kellyPct: number;
}

interface AppState {
  betSlip: BetSlipItem[];
  bankroll: number;
  lastUpdated: string | null;
}

const initialState: AppState = {
  betSlip: [],
  bankroll: 1000,
  lastUpdated: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    addToBetSlip: (state, action: PayloadAction<BetSlipItem>) => {
      if (!state.betSlip.find(b => b.id === action.payload.id)) {
        state.betSlip.push(action.payload);
      }
    },
    removeFromBetSlip: (state, action: PayloadAction<string>) => {
      state.betSlip = state.betSlip.filter(b => b.id !== action.payload);
    },
    clearBetSlip: (state) => { state.betSlip = []; },
    setBankroll: (state, action: PayloadAction<number>) => { state.bankroll = action.payload; },
    setLastUpdated: (state, action: PayloadAction<string>) => { state.lastUpdated = action.payload; },
  },
});

export const { addToBetSlip, removeFromBetSlip, clearBetSlip, setBankroll, setLastUpdated } = appSlice.actions;

export const store = configureStore({ reducer: { app: appSlice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
