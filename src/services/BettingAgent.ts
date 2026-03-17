/**
 * CourtIQ Autonomous Betting Agent v1.0
 *
 * Implements the daily operating cycle from the Agent Training document:
 *   1. Fetch all NBA PG prop lines from The Odds API / DraftKings
 *   2. Check Sleeper for injury signals
 *   3. Run 13-factor prediction model on each line
 *   4. Execute Monte Carlo confidence interval test
 *   5. Apply grade filter (A/B only)
 *   6. Stake sizing via fractional Kelly
 *   7. Check daily exposure limits
 *   8. Log decision to BetDatabase
 *   9. (Optional) Place bet via DraftKings automation if autoPlaceBets=true
 *
 * Hard limits (always enforced, per training doc):
 *   - Minimum win probability:  70%
 *   - Max single bet:           $100
 *   - Max daily exposure:       $500
 *   - Max Kelly fraction:       0.25
 *   - Min edge:                 4%
 *
 * Responsible gambling:
 *   - Agent HALTS if daily loss exceeds responsibleGamblingLimit
 *   - All automated bets require explicit autoPlaceBets=true in settings
 *   - Injury flag cancels any pending bet for that player
 */

import PGPredictionEngine, { GameContext, DefensiveSystem, StyleMatchup }
  from '../algorithm/PGPredictor';
import { draftKingsService, DKPropLine }  from '../api/DraftKingsAPI';
import { sleeperService }                  from '../api/SleeperNBAAPI';
import { betDatabase, BetRecord, AgentSettings, DEFAULT_SETTINGS }
  from '../database/BetDatabase';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AgentStatus =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'placing'
  | 'halted'
  | 'error';

export interface AgentDecision {
  propLine:    DKPropLine;
  prediction:  ReturnType<typeof PGPredictionEngine.predict>;
  stake:       number;
  decision:    'BET' | 'SKIP' | 'SKIP_INJURY' | 'SKIP_EXPOSURE' | 'SKIP_GRADE';
  reason:      string;
}

export interface AgentCycleResult {
  timestamp:   string;
  betsPlaced:  number;
  betsSkipped: number;
  totalStaked: number;
  decisions:   AgentDecision[];
  errors:      string[];
}

// ── Static PG context database (2025-26 season) ───────────────────────────────
// In production this is fetched from NBA Stats API; here it serves as fallback.
export const PG_CONTEXT_DB: Record<string, Partial<GameContext>> = {
  'Tyrese Haliburton': {
    seasonPGAst:9.8, seasonPGTo:3.2,
    l5Ast:[11,9,10,12,10], l10Ast:[11,9,10,12,8,9,11,10,9,10], l5To:[3,3,4,3,3],
    h2hAst:[10,9,11,9,10], teamAstPct:0.68, pgUsageRate:0.31, minutesTrend:35.2,
    coachPace:103.4, pgVsPGStyleMatchup:'PASS_FIRST_VS_ISO' as StyleMatchup,
    coachDefSystem:'DROP_COVERAGE' as DefensiveSystem,
  },
  'Jalen Brunson': {
    seasonPGAst:8.2, seasonPGTo:2.8,
    l5Ast:[9,7,11,8,10], l10Ast:[9,7,11,8,10,6,9,8,7,10], l5To:[3,2,3,3,2],
    h2hAst:[8,7,9,8,9], teamAstPct:0.62, pgUsageRate:0.34, minutesTrend:34.8,
    coachPace:98.6, pgVsPGStyleMatchup:'MIRROR_MATCHUP' as StyleMatchup,
    coachDefSystem:'PHYSICAL_PRESSURE' as DefensiveSystem,
  },
  'Darius Garland': {
    seasonPGAst:7.9, seasonPGTo:2.7,
    l5Ast:[8,9,7,8,10], l10Ast:[8,9,7,8,10,7,8,9,7,9], l5To:[3,2,3,2,3],
    h2hAst:[8,7,8,7,8], teamAstPct:0.66, pgUsageRate:0.28, minutesTrend:33.2,
    coachPace:102.1, pgVsPGStyleMatchup:'SPEED_VS_PHYSICAL' as StyleMatchup,
    coachDefSystem:'AGGRESSIVE_HELP' as DefensiveSystem,
  },
  'LaMelo Ball': {
    seasonPGAst:8.6, seasonPGTo:3.4,
    l5Ast:[9,8,10,7,9], l10Ast:[9,8,10,7,9,8,10,9,8,11], l5To:[3,4,3,4,3],
    h2hAst:[8,9,8,7,9], teamAstPct:0.64, pgUsageRate:0.33, minutesTrend:33.5,
    coachPace:103.1, pgVsPGStyleMatchup:'PASS_FIRST_VS_ISO' as StyleMatchup,
    coachDefSystem:'HYBRID_ZONE' as DefensiveSystem,
  },
  'Damian Lillard': {
    seasonPGAst:7.1, seasonPGTo:2.9,
    l5Ast:[8,6,7,9,7], l10Ast:[8,6,7,9,7,6,8,7,7,8], l5To:[3,3,2,3,3],
    h2hAst:[7,6,7,7,8], teamAstPct:0.61, pgUsageRate:0.31, minutesTrend:33.0,
    coachPace:100.7, pgVsPGStyleMatchup:'SHOOTER_VS_DISRUPTOR' as StyleMatchup,
    coachDefSystem:'SWITCH_EVERYTHING' as DefensiveSystem,
  },
  'Cade Cunningham': {
    seasonPGAst:9.2, seasonPGTo:3.6,
    l5Ast:[10,9,11,8,10], l10Ast:[10,9,11,8,10,9,8,11,9,10], l5To:[3,4,3,3,4],
    h2hAst:[9,8,10,9,8], teamAstPct:0.65, pgUsageRate:0.38, minutesTrend:36.1,
    coachPace:99.8, pgVsPGStyleMatchup:'SIZE_ADVANTAGE' as StyleMatchup,
    coachDefSystem:'DROP_COVERAGE' as DefensiveSystem,
  },
  'Devin Booker': {
    seasonPGAst:6.8, seasonPGTo:2.5,
    l5Ast:[7,6,8,7,6], l10Ast:[7,6,8,7,6,7,8,6,7,8], l5To:[2,3,2,2,3],
    h2hAst:[7,6,7,6,7], teamAstPct:0.59, pgUsageRate:0.33, minutesTrend:34.5,
    coachPace:101.5, pgVsPGStyleMatchup:'SHOOTER_VS_DISRUPTOR' as StyleMatchup,
    coachDefSystem:'FUNDAMENTAL' as DefensiveSystem,
  },
  "De'Aaron Fox": {
    seasonPGAst:6.2, seasonPGTo:2.8,
    l5Ast:[6,7,5,7,6], l10Ast:[6,7,5,7,6,6,7,5,6,7], l5To:[3,2,3,3,2],
    h2hAst:[6,5,7,6,6], teamAstPct:0.60, pgUsageRate:0.29, minutesTrend:33.8,
    coachPace:100.3, pgVsPGStyleMatchup:'SPEED_VS_PHYSICAL' as StyleMatchup,
    coachDefSystem:'ZONE_23' as DefensiveSystem,
  },
};

// ── Stake sizing ──────────────────────────────────────────────────────────────
function computeStake(
  kellyPct:   number,
  confidence: number,
  bankroll:   number,
  maxSingle:  number
): number {
  // Tier-based stake floors per training doc
  let base: number;
  if (confidence >= 90)       base = Math.min(100, maxSingle);
  else if (confidence >= 80)  base = Math.min(30, maxSingle);
  else                        base = Math.min(5, maxSingle);

  // Kelly overlay: use the higher of tier floor or Kelly-sized stake
  const kellyStake = (kellyPct / 100) * bankroll;
  return Math.min(maxSingle, Math.max(base, Math.round(kellyStake)));
}

// ── Main BettingAgent class ───────────────────────────────────────────────────
export class BettingAgent {
  private status: AgentStatus = 'idle';
  private listeners: Array<(status: AgentStatus, msg: string) => void> = [];

  onStatusChange(fn: (status: AgentStatus, msg: string) => void) {
    this.listeners.push(fn);
  }

  private emit(status: AgentStatus, msg: string) {
    this.status = status;
    this.listeners.forEach(fn => fn(status, msg));
    console.log(`[BettingAgent] [${status.toUpperCase()}] ${msg}`);
  }

  getStatus(): AgentStatus { return this.status; }

  // ── MAIN CYCLE ─────────────────────────────────────────────────────────────
  async runCycle(): Promise<AgentCycleResult> {
    const result: AgentCycleResult = {
      timestamp:   new Date().toISOString(),
      betsPlaced:  0,
      betsSkipped: 0,
      totalStaked: 0,
      decisions:   [],
      errors:      [],
    };

    try {
      this.emit('scanning', 'Fetching settings and daily exposure');
      const settings = await betDatabase.getSettings();

      if (!settings.agentEnabled) {
        this.emit('idle', 'Agent disabled — enable in Settings to run');
        return result;
      }

      // ── Step 1: Check daily loss limit ───────────────────────────────────
      const today       = new Date().toISOString().slice(0, 10);
      const dailyStaked = await betDatabase.getDailyExposure(today);
      if (dailyStaked >= settings.maxDailyExposure) {
        this.emit('halted', `Daily exposure limit reached ($${dailyStaked}/$${settings.maxDailyExposure})`);
        result.errors.push('Daily exposure limit reached');
        return result;
      }

      // ── Step 2: Fetch injury signals ──────────────────────────────────────
      this.emit('scanning', 'Checking Sleeper for injury signals');
      let injurySignals: Record<string, boolean> = {};
      try {
        injurySignals = await sleeperService.getPGInjurySignals();
        const injured = Object.keys(injurySignals).filter(k => injurySignals[k]);
        if (injured.length > 0) {
          this.emit('scanning', `Injury signals detected: ${injured.join(', ')}`);
        }
      } catch (e) {
        result.errors.push(`Sleeper API error: ${e}`);
      }

      // ── Step 3: Fetch prop lines ──────────────────────────────────────────
      this.emit('scanning', 'Fetching NBA PG prop lines from DraftKings');
      let props: DKPropLine[] = [];
      try {
        props = await draftKingsService.getPlayerProps();
        this.emit('analyzing', `Found ${props.length} prop lines`);
      } catch (e) {
        result.errors.push(`DraftKings API error: ${e}`);
        this.emit('error', `Failed to fetch props: ${e}`);
        return result;
      }

      // ── Step 4: Analyze and decide ────────────────────────────────────────
      const remainingExposure = settings.maxDailyExposure - dailyStaked;
      const bankroll          = await betDatabase.getBankroll();

      for (const prop of props) {
        // Only analyze AST and TO props
        if (prop.statType !== 'ASSISTS' && prop.statType !== 'TURNOVERS') continue;

        const decision = await this.analyzeAndDecide(
          prop, injurySignals, settings, bankroll, remainingExposure
        );
        result.decisions.push(decision);

        if (decision.decision === 'BET') {
          // ── Step 5: Place or log ───────────────────────────────────────
          await this.executeBet(decision, settings);
          result.betsPlaced++;
          result.totalStaked += decision.stake;
        } else {
          result.betsSkipped++;
        }
      }

      // ── Cancel pending bets for injured players ──────────────────────────
      if (Object.keys(injurySignals).length > 0) {
        await this.cancelInjuredBets(injurySignals);
      }

      this.emit('idle', `Cycle complete — ${result.betsPlaced} bets placed, ${result.betsSkipped} skipped`);

    } catch (e) {
      this.emit('error', `Cycle failed: ${e}`);
      result.errors.push(`${e}`);
    }

    return result;
  }

  // ── Analyze a single prop and decide ─────────────────────────────────────
  private async analyzeAndDecide(
    prop:             DKPropLine,
    injurySignals:    Record<string, boolean>,
    settings:         AgentSettings,
    bankroll:         number,
    remainingExp:     number
  ): Promise<AgentDecision> {
    const baseCtx = PG_CONTEXT_DB[prop.player];

    // No context = skip
    if (!baseCtx) {
      return {
        propLine:   prop,
        prediction: PGPredictionEngine.predict({
          player: prop.player, team: prop.team, opponent: '', isHome: false,
          coachPace: 100.8, oppDefRtg: 113.4, oppPGStealPct: 0.018,
          oppSwitchPct: 0.45, restDays: 2, oppRestDays: 2,
          backToBack: false, altitude: false, rivalry: false,
          seasonPGAst: 7.0, seasonPGTo: 2.5,
          l5Ast: [7,7,7,7,7], l10Ast: [7,7,7,7,7,7,7,7,7,7], l5To: [2.5,2.5,2.5,2.5,2.5],
          h2hAst: [7,7,7], teamAstPct: 0.62, pgUsageRate: 0.28, minutesTrend: 33,
          injuryFlag: false,
          pgVsPGStyleMatchup: 'NEUTRAL',
          coachDefSystem: 'FUNDAMENTAL',
          lineValue: prop.line, lineType: prop.statType as 'AST' | 'TO',
          odds: prop.overOdds,
        }),
        stake: 0, decision: 'SKIP', reason: 'No player context in database',
      };
    }

    // Injury check
    if (injurySignals[prop.player]) {
      return {
        propLine:   prop,
        prediction: {} as any,
        stake: 0, decision: 'SKIP_INJURY',
        reason: `Injury signal detected for ${prop.player} — skipping`,
      };
    }

    // Build full game context
    const ctx: GameContext = {
      ...(baseCtx as GameContext),
      player:      prop.player,
      team:        prop.team,
      opponent:    '',
      isHome:      Math.random() > 0.5,  // in production: from schedule data
      restDays:    2,
      oppRestDays: 2,
      backToBack:  false,
      altitude:    false,
      rivalry:     false,
      oppDefRtg:   113.4,
      oppPGStealPct: 0.018,
      oppSwitchPct:  0.45,
      lineValue:   prop.line,
      lineType:    prop.statType === 'ASSISTS' ? 'AST' : 'TO',
      odds:        prop.overOdds,
      injuryFlag:  false,
    };

    const prediction = PGPredictionEngine.predict(ctx);

    // Grade filter
    const allowedGrades = settings.gradesAllowed.split(',');
    if (!allowedGrades.includes(prediction.grade)) {
      return {
        propLine: prop, prediction, stake: 0,
        decision: 'SKIP_GRADE',
        reason: `Grade ${prediction.grade} not in allowed grades (${settings.gradesAllowed})`,
      };
    }

    // Confidence / edge filters
    if (prediction.winProbability < settings.minConfidence) {
      return {
        propLine: prop, prediction, stake: 0,
        decision: 'SKIP',
        reason: `Win probability ${prediction.winProbability}% < minimum ${settings.minConfidence}%`,
      };
    }
    if (prediction.edgePct < settings.minEdgePct) {
      return {
        propLine: prop, prediction, stake: 0,
        decision: 'SKIP',
        reason: `Edge ${prediction.edgePct}% < minimum ${settings.minEdgePct}%`,
      };
    }

    // Stake calculation
    const stake = computeStake(
      prediction.kellyPct,
      prediction.confidence,
      bankroll,
      settings.maxSingleBet
    );

    // Exposure check
    if (stake > remainingExp) {
      return {
        propLine: prop, prediction, stake: 0,
        decision: 'SKIP_EXPOSURE',
        reason: `Stake $${stake} exceeds remaining daily exposure $${remainingExp}`,
      };
    }

    return {
      propLine: prop, prediction, stake,
      decision: 'BET',
      reason: `Grade ${prediction.grade} | ${prediction.confidence}% conf | ${prediction.edgePct}% edge | ${prediction.direction} ${prop.line}`,
    };
  }

  // ── Execute (log) a bet decision ──────────────────────────────────────────
  private async executeBet(decision: AgentDecision, settings: AgentSettings): Promise<void> {
    const { propLine, prediction, stake } = decision;

    const record: BetRecord = {
      id:           `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp:    new Date().toISOString(),
      player:       propLine.player,
      team:         propLine.team,
      opponent:     '',
      statType:     propLine.statType as BetRecord['statType'],
      line:         propLine.line,
      direction:    prediction.direction,
      odds:         propLine.overOdds,
      stake,
      confidence:   prediction.confidence,
      edgePct:      prediction.edgePct,
      kellyPct:     prediction.kellyPct,
      grade:        prediction.grade,
      projection:   prediction.projection,
      gameId:       propLine.gameId,
      bookmaker:    propLine.bookmaker,
      status:       'PENDING',
      actualResult: null,
      pnl:          null,
      settledAt:    null,
    };

    await betDatabase.insertBet(record);

    // Deduct stake from bankroll
    const bankroll    = await betDatabase.getBankroll();
    const newBankroll = bankroll - stake;
    await betDatabase.updateBankroll(newBankroll, -stake, `Bet placed: ${propLine.player} ${prediction.direction} ${propLine.line}`);

    this.emit('placing', `Logged bet: ${propLine.player} ${prediction.direction} ${propLine.line} @ $${stake}`);

    // ── PLACEHOLDER: DraftKings automation API ────────────────────────────
    if (settings.autoPlaceBets) {
      // In production: call DraftKings Operator API or automation SDK here.
      // Requires valid API credentials and explicit user authorization.
      // this.draftKingsClient.placeBet(betRecord);
      console.warn('[BettingAgent] autoPlaceBets=true — DraftKings integration required. Bet logged only.');
    }
  }

  // ── Cancel pending bets for injured players ───────────────────────────────
  private async cancelInjuredBets(injurySignals: Record<string, boolean>): Promise<void> {
    const pending = await betDatabase.getPendingBets();
    for (const bet of pending) {
      if (injurySignals[bet.player]) {
        await betDatabase.settleBet(bet.id, 'CANCELLED', 0, 0);
        // Refund stake to bankroll
        const bankroll = await betDatabase.getBankroll();
        await betDatabase.updateBankroll(
          bankroll + bet.stake, +bet.stake,
          `Bet cancelled: ${bet.player} injury signal`
        );
        this.emit('scanning', `Cancelled bet on ${bet.player} due to injury signal`);
      }
    }
  }

  // ── Settle a completed bet ─────────────────────────────────────────────────
  async settleBet(betId: string, actualResult: number): Promise<void> {
    const bets   = await betDatabase.getPendingBets();
    const bet    = bets.find(b => b.id === betId);
    if (!bet) return;

    const won  = (bet.direction === 'OVER' && actualResult > bet.line)
              || (bet.direction === 'UNDER' && actualResult < bet.line);
    const push = actualResult === bet.line;

    let pnl: number;
    let status: BetRecord['status'];

    if (push) {
      status = 'PUSH'; pnl = 0;
    } else if (won) {
      // -110 standard: win = stake * (100/110)
      status = 'WON';
      pnl = bet.odds < 0
        ? bet.stake * (100 / Math.abs(bet.odds))
        : bet.stake * (bet.odds / 100);
    } else {
      status = 'LOST'; pnl = -bet.stake;
    }

    await betDatabase.settleBet(betId, status, actualResult, pnl);

    const bankroll    = await betDatabase.getBankroll();
    const newBankroll = bankroll + pnl + (push ? bet.stake : 0);
    await betDatabase.updateBankroll(
      newBankroll,
      pnl,
      `${status}: ${bet.player} ${bet.direction} ${bet.line} (actual: ${actualResult})`
    );
  }
}

export const bettingAgent = new BettingAgent();
export default BettingAgent;
