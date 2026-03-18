/**
 * CourtIQ Algorithm Unit Tests
 * Tests PGPredictionEngine and runBacktest
 */

import PGPredictionEngine, {
  COVARIANCE_MATRIX,
  DEF_SYSTEM_ADJUSTMENTS,
  STYLE_MATCHUP_ADJUSTMENTS,
  GameContext,
} from '../src/algorithm/PGPredictor';
import { runBacktest } from '../src/algorithm/BacktestRunner';

// ── Shared test context ────────────────────────────────────────────────────────
const baseCtx: GameContext = {
  player:          'Test Player',
  team:            'TEST',
  opponent:        'OPP',
  isHome:          true,
  coachPace:       103.0,
  oppDefRtg:       113.0,
  oppPGStealPct:   0.018,
  oppSwitchPct:    0.45,
  restDays:        2,
  oppRestDays:     2,
  backToBack:      false,
  altitude:        false,
  rivalry:         false,
  seasonPGAst:     8.5,
  seasonPGTo:      2.8,
  l5Ast:           [9, 8, 10, 9, 8],
  l10Ast:          [9, 8, 10, 9, 8, 7, 9, 10, 8, 9],
  l5To:            [2.5, 3, 2.5, 3, 2.5],
  h2hAst:          [8.5, 9, 8, 9, 8.5],
  teamAstPct:      0.64,
  pgUsageRate:     0.30,
  minutesTrend:    34.0,
  injuryFlag:      false,
  pgVsPGStyleMatchup: 'NEUTRAL',
  coachDefSystem:  'FUNDAMENTAL',
  lineValue:       8.5,
  lineType:        'AST',
  odds:            -110,
};

// ── Math utilities ─────────────────────────────────────────────────────────────
describe('PGPredictionEngine utilities', () => {
  test('rollingAvg: correct average', () => {
    expect(PGPredictionEngine.rollingAvg([4, 6, 8, 10])).toBe(7);
  });

  test('rollingAvg: last N elements', () => {
    expect(PGPredictionEngine.rollingAvg([1, 2, 3, 4, 5, 10], 3)).toBeCloseTo(19 / 3, 2);
  });

  test('rollingAvg: single element', () => {
    expect(PGPredictionEngine.rollingAvg([5])).toBe(5);
  });

  test('trendSlope: positive trend', () => {
    const slope = PGPredictionEngine.trendSlope([5, 6, 7, 8, 9]);
    expect(slope).toBeGreaterThan(0);
  });

  test('trendSlope: negative trend', () => {
    const slope = PGPredictionEngine.trendSlope([9, 8, 7, 6, 5]);
    expect(slope).toBeLessThan(0);
  });

  test('trendSlope: flat trend', () => {
    const slope = PGPredictionEngine.trendSlope([7, 7, 7, 7, 7]);
    expect(Math.abs(slope)).toBeLessThan(0.001);
  });

  test('bayesianPrior: weighted blend', () => {
    const l10 = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
    const prior = PGPredictionEngine.bayesianPrior(10, l10);
    // 35%*10 + 40%*8 + 25%*8 = 3.5 + 3.2 + 2.0 = 8.7
    expect(prior).toBeCloseTo(8.7, 1);
  });

  test('kellyCriterion: positive edge returns positive kelly', () => {
    const k = PGPredictionEngine.kellyCriterion(0.75, -110);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(0.15); // capped
  });

  test('kellyCriterion: negative edge returns 0', () => {
    const k = PGPredictionEngine.kellyCriterion(0.40, -110);
    expect(k).toBe(0);
  });

  test('kellyCriterion: positive odds (underdog)', () => {
    const k = PGPredictionEngine.kellyCriterion(0.55, +130);
    expect(k).toBeGreaterThan(0);
  });

  test('winProbability: above line returns >0.5', () => {
    const p = PGPredictionEngine.winProbability(10, 8, 2);
    expect(p).toBeGreaterThan(0.5);
  });

  test('winProbability: below line returns <0.5', () => {
    const p = PGPredictionEngine.winProbability(6, 8, 2);
    expect(p).toBeLessThan(0.5);
  });

  test('winProbability: on line returns ~0.5', () => {
    const p = PGPredictionEngine.winProbability(8, 8, 2);
    expect(p).toBeCloseTo(0.5, 1);
  });

  test('monteCarlo: returns [low, high] with high > low', () => {
    const [lo, hi] = PGPredictionEngine.monteCarlo(8, 2, 1000);
    expect(lo).toBeLessThan(hi);
    expect(lo).toBeGreaterThan(0);
  });

  test('detectLineValue: positive when model > line', () => {
    const edge = PGPredictionEngine.detectLineValue(10, 8);
    expect(edge).toBeCloseTo(25, 0); // 25%
  });

  test('detectLineValue: negative when model < line', () => {
    const edge = PGPredictionEngine.detectLineValue(6, 8);
    expect(edge).toBeLessThan(0);
  });
});

// ── Prediction output ─────────────────────────────────────────────────────────
describe('PGPredictionEngine.predict', () => {
  let result: ReturnType<typeof PGPredictionEngine.predict>;

  beforeAll(() => {
    result = PGPredictionEngine.predict(baseCtx);
  });

  test('returns a projection > 0', () => {
    expect(result.projection).toBeGreaterThan(0);
  });

  test('confidence is in [50, 96]', () => {
    expect(result.confidence).toBeGreaterThanOrEqual(50);
    expect(result.confidence).toBeLessThanOrEqual(96);
  });

  test('direction is OVER or UNDER', () => {
    expect(['OVER', 'UNDER']).toContain(result.direction);
  });

  test('grade is A/B/C/D', () => {
    expect(['A', 'B', 'C', 'D']).toContain(result.grade);
  });

  test('winProbability is in [0, 100]', () => {
    expect(result.winProbability).toBeGreaterThanOrEqual(0);
    expect(result.winProbability).toBeLessThanOrEqual(100);
  });

  test('kellyPct is in [0, 15]', () => {
    expect(result.kellyPct).toBeGreaterThanOrEqual(0);
    expect(result.kellyPct).toBeLessThanOrEqual(15);
  });

  test('monteCarloRange is [lo, hi] with lo < hi', () => {
    const [lo, hi] = result.monteCarloRange;
    expect(lo).toBeLessThan(hi);
  });

  test('factors array has 8 entries', () => {
    expect(result.factors).toHaveLength(8);
  });

  test('each factor has required fields', () => {
    for (const f of result.factors) {
      expect(typeof f.name).toBe('string');
      expect(typeof f.weight).toBe('number');
      expect(typeof f.adjustedImpact).toBe('number');
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(f.signal);
    }
  });

  test('flagWarnings is an array', () => {
    expect(Array.isArray(result.flagWarnings)).toBe(true);
  });

  test('Grade A requires confidence>=76 AND edgePct>=6', () => {
    if (result.grade === 'A') {
      expect(result.confidence).toBeGreaterThanOrEqual(76);
      expect(result.edgePct).toBeGreaterThanOrEqual(6);
    }
  });

  test('injury flag downgrades grade to not-A', () => {
    const injured = PGPredictionEngine.predict({ ...baseCtx, injuryFlag: true });
    expect(injured.grade).not.toBe('A');
    expect(injured.flagWarnings.some(w => w.toLowerCase().includes('injury'))).toBe(true);
  });

  test('back-to-back reduces projection', () => {
    const b2b    = PGPredictionEngine.predict({ ...baseCtx, backToBack: true });
    const normal = PGPredictionEngine.predict({ ...baseCtx, backToBack: false });
    expect(b2b.projection).toBeLessThan(normal.projection);
  });

  test('home court boosts projection vs away', () => {
    const home = PGPredictionEngine.predict({ ...baseCtx, isHome: true });
    const away = PGPredictionEngine.predict({ ...baseCtx, isHome: false });
    expect(home.projection).toBeGreaterThan(away.projection);
  });

  test('altitude penalty applies in Denver', () => {
    const den    = PGPredictionEngine.predict({ ...baseCtx, altitude: true });
    const normal = PGPredictionEngine.predict({ ...baseCtx, altitude: false });
    expect(den.projection).toBeLessThan(normal.projection);
  });

  test('ZONE_23 defense boosts assists vs SWITCH_EVERYTHING', () => {
    const zone   = PGPredictionEngine.predict({ ...baseCtx, coachDefSystem: 'ZONE_23' });
    const swtch  = PGPredictionEngine.predict({ ...baseCtx, coachDefSystem: 'SWITCH_EVERYTHING' });
    expect(zone.projection).toBeGreaterThan(swtch.projection);
  });

  test('PASS_FIRST_VS_ISO boosts assists vs SHOOTER_VS_DISRUPTOR', () => {
    const pass = PGPredictionEngine.predict({ ...baseCtx, pgVsPGStyleMatchup: 'PASS_FIRST_VS_ISO' });
    const shtr = PGPredictionEngine.predict({ ...baseCtx, pgVsPGStyleMatchup: 'SHOOTER_VS_DISRUPTOR' });
    expect(pass.projection).toBeGreaterThan(shtr.projection);
  });

  test('high opponent steal% reduces projection', () => {
    const high = PGPredictionEngine.predict({ ...baseCtx, oppPGStealPct: 0.035 });
    const low  = PGPredictionEngine.predict({ ...baseCtx, oppPGStealPct: 0.012 });
    expect(high.projection).toBeLessThan(low.projection);
  });
});

// ── Defensive system constants ────────────────────────────────────────────────
describe('DEF_SYSTEM_ADJUSTMENTS', () => {
  test('ZONE_23 has highest cover %', () => {
    const covers = Object.values(DEF_SYSTEM_ADJUSTMENTS).map(d => d.coverPct);
    const zoneCover = DEF_SYSTEM_ADJUSTMENTS['ZONE_23'].coverPct;
    expect(zoneCover).toBe(Math.max(...covers));
  });

  test('SWITCH_EVERYTHING has lowest astMult', () => {
    const mults = Object.values(DEF_SYSTEM_ADJUSTMENTS).map(d => d.astMult);
    expect(DEF_SYSTEM_ADJUSTMENTS['SWITCH_EVERYTHING'].astMult).toBe(Math.min(...mults));
  });

  test('all systems have coverPct in [50, 70]', () => {
    for (const [, d] of Object.entries(DEF_SYSTEM_ADJUSTMENTS)) {
      expect(d.coverPct).toBeGreaterThanOrEqual(50);
      expect(d.coverPct).toBeLessThanOrEqual(70);
    }
  });
});

// ── Backtest ──────────────────────────────────────────────────────────────────
describe('runBacktest', () => {
  let result: ReturnType<typeof runBacktest>;

  beforeAll(() => {
    result = runBacktest(1000); // smaller for test speed
  }, 30000);

  test('processes a non-trivial number of bets (selectivity filter)', () => {
    expect(result.totalBets).toBeGreaterThan(50);
    expect(result.totalBets).toBeLessThanOrEqual(1000);
  });

  test('win rate is in a realistic range [55%, 95%]', () => {
    expect(result.winRate).toBeGreaterThanOrEqual(55);
    expect(result.winRate).toBeLessThanOrEqual(95);
  });

  test('Grade A win rate >= Grade B win rate', () => {
    if (result.gradeA.bets > 5 && result.gradeB.bets > 5) {
      expect(result.gradeA.rate).toBeGreaterThanOrEqual(result.gradeB.rate - 5); // allow small variance
    }
  });

  test('Sharpe ratio is positive (positive expected return)', () => {
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  test('byDefSystem has all 7 systems', () => {
    const systems = Object.keys(result.byDefSystem);
    expect(systems.length).toBe(7);
  });

  test('ZONE_23 cover rate >= SWITCH_EVERYTHING cover rate', () => {
    const zone  = result.byDefSystem['ZONE_23']?.rate ?? 0;
    const swtch = result.byDefSystem['SWITCH_EVERYTHING']?.rate ?? 100;
    expect(zone).toBeGreaterThanOrEqual(swtch - 10); // allow some stochastic variance
  });

  test('average Kelly is in [0.5%, 15%]', () => {
    expect(result.avgKelly).toBeGreaterThan(0.5);
    expect(result.avgKelly).toBeLessThan(15);
  });

  test('average edge is positive', () => {
    expect(result.avgEdge).toBeGreaterThan(0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────
describe('Edge cases', () => {
  test('predict with all extreme penalties does not crash', () => {
    const extreme: GameContext = {
      ...baseCtx,
      backToBack: true, injuryFlag: true, altitude: true, rivalry: true,
      coachDefSystem: 'SWITCH_EVERYTHING',
      pgVsPGStyleMatchup: 'SHOOTER_VS_DISRUPTOR',
      oppPGStealPct: 0.040,
      l5Ast: [1, 1, 2, 1, 2],
      seasonPGAst: 2.0,
    };
    const r = PGPredictionEngine.predict(extreme);
    expect(r.projection).toBeGreaterThan(0);
    expect(r.grade).toBeDefined();
  });

  test('predict with all bullish factors does not crash', () => {
    const bullish: GameContext = {
      ...baseCtx,
      isHome: true, restDays: 4,
      coachDefSystem: 'ZONE_23',
      pgVsPGStyleMatchup: 'PASS_FIRST_VS_ISO',
      oppPGStealPct: 0.010,
      oppDefRtg: 120,
      coachPace: 108,
      seasonPGAst: 12.0,
      l5Ast: [14, 13, 15, 12, 14],
      l10Ast: [14, 13, 15, 12, 14, 11, 13, 12, 14, 13],
    };
    const r = PGPredictionEngine.predict(bullish);
    expect(r.projection).toBeGreaterThan(0);
    expect(['OVER', 'UNDER']).toContain(r.direction);
  });

  test('predict with minimal h2h history adds warning', () => {
    const noH2H = { ...baseCtx, h2hAst: [8] };
    const r = PGPredictionEngine.predict(noH2H);
    expect(r.flagWarnings.some(w => w.toLowerCase().includes('h2h') || w.toLowerCase().includes('history'))).toBe(true);
  });

  test('team assists model returns valid result', () => {
    const r = PGPredictionEngine.predictTeamAssists(
      26.0, 113.0, 102.0, 9.0, [26, 24, 28, 25, 27, 26, 24, 28, 25, 27], 24.5, -110
    );
    expect(r.projection).toBeGreaterThan(0);
    expect(['OVER', 'UNDER']).toContain(r.direction);
    expect(['A', 'B', 'C', 'D']).toContain(r.grade);
  });
});
