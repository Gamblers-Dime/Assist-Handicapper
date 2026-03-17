/**
 * DraftKings Sportsbook API Service
 * Fetches live NBA player props, spreads, and totals
 *
 * DraftKings does not have an official public API, but their odds data is
 * accessible via their public-facing endpoints used by the web app.
 * For production use, supplement with an odds aggregator like The Odds API.
 */

import axios, { AxiosInstance } from 'axios';

const DK_BASE      = 'https://sportsbook.draftkings.com';
const ODDS_API_KEY = process.env.ODDS_API_KEY || ''; // https://the-odds-api.com

export interface DKPropLine {
  player: string;
  team: string;
  statType: 'ASSISTS' | 'TURNOVERS' | 'POINTS' | 'REBOUNDS' | 'PRA';
  line: number;
  overOdds: number;    // American odds
  underOdds: number;
  gameId: string;
  gameTime: string;
  bookmaker: string;
}

export interface DKGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  spread: { home: number; away: number; homeOdds: number; awayOdds: number };
  total: { line: number; overOdds: number; underOdds: number };
  moneyline: { home: number; away: number };
  source: string;
}

class DraftKingsService {
  private client: AxiosInstance;
  private oddsClient: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: DK_BASE,
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android 14; Mobile)',
        'Accept': 'application/json',
      },
    });

    this.oddsClient = axios.create({
      baseURL: 'https://api.the-odds-api.com/v4',
      timeout: 8000,
      params: { apiKey: ODDS_API_KEY },
    });
  }

  // ── Fetch NBA games with spreads and totals ─────────────────────────────
  async getNBAGames(): Promise<DKGame[]> {
    try {
      // Primary: The Odds API (free tier: 500 requests/month)
      const res = await this.oddsClient.get('/sports/basketball_nba/odds', {
        params: {
          regions: 'us',
          markets: 'h2h,spreads,totals',
          bookmakers: 'draftkings,fanduel,betmgm',
          oddsFormat: 'american',
        },
      });

      return res.data.map((g: any) => {
        const dk = g.bookmakers.find((b: any) => b.key === 'draftkings') || g.bookmakers[0];
        const markets = dk?.markets || [];
        const spreads = markets.find((m: any) => m.key === 'spreads');
        const totals  = markets.find((m: any) => m.key === 'totals');
        const h2h     = markets.find((m: any) => m.key === 'h2h');

        return {
          id: g.id,
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          commenceTime: g.commence_time,
          spread: {
            home: spreads?.outcomes?.find((o: any) => o.name === g.home_team)?.point ?? 0,
            away: spreads?.outcomes?.find((o: any) => o.name === g.away_team)?.point ?? 0,
            homeOdds: spreads?.outcomes?.find((o: any) => o.name === g.home_team)?.price ?? -110,
            awayOdds: spreads?.outcomes?.find((o: any) => o.name === g.away_team)?.price ?? -110,
          },
          total: {
            line: totals?.outcomes?.[0]?.point ?? 220,
            overOdds: totals?.outcomes?.find((o: any) => o.name === 'Over')?.price ?? -110,
            underOdds: totals?.outcomes?.find((o: any) => o.name === 'Under')?.price ?? -110,
          },
          moneyline: {
            home: h2h?.outcomes?.find((o: any) => o.name === g.home_team)?.price ?? -150,
            away: h2h?.outcomes?.find((o: any) => o.name === g.away_team)?.price ?? +130,
          },
          source: dk?.title ?? 'DraftKings',
        } as DKGame;
      });
    } catch (err) {
      console.warn('[DraftKings] API unavailable, using cached data:', err);
      return this.getMockGames();
    }
  }

  // ── Fetch player props (assists, turnovers, etc.) ────────────────────────
  async getPlayerProps(sportKey = 'basketball_nba'): Promise<DKPropLine[]> {
    try {
      const res = await this.oddsClient.get(`/sports/${sportKey}/events`, { params: { dateFormat: 'iso' } });
      const events = res.data.slice(0, 10); // today's games

      const props: DKPropLine[] = [];
      for (const event of events) {
        try {
          const propRes = await this.oddsClient.get(`/sports/${sportKey}/events/${event.id}/odds`, {
            params: {
              regions: 'us',
              markets: 'player_assists,player_turnovers,player_points,player_pra',
              bookmakers: 'draftkings',
              oddsFormat: 'american',
            },
          });

          const dk = propRes.data.bookmakers?.[0];
          if (!dk) continue;

          for (const market of dk.markets) {
            const statMap: Record<string, DKPropLine['statType']> = {
              player_assists:    'ASSISTS',
              player_turnovers:  'TURNOVERS',
              player_points:     'POINTS',
              player_pra:        'PRA',
            };
            const statType = statMap[market.key] || 'ASSISTS';
            for (let i = 0; i < market.outcomes.length; i += 2) {
              const over  = market.outcomes.find((o: any) => o.description === 'Over'  && o.name === market.outcomes[i].name);
              const under = market.outcomes.find((o: any) => o.description === 'Under' && o.name === market.outcomes[i].name);
              if (over && under) {
                props.push({
                  player: over.name,
                  team: event.home_team,
                  statType,
                  line: over.point,
                  overOdds: over.price,
                  underOdds: under.price,
                  gameId: event.id,
                  gameTime: event.commence_time,
                  bookmaker: dk.title,
                });
              }
            }
          }
        } catch (inner) {
          console.warn(`[DraftKings] Props fetch failed for event ${event.id}`);
        }
      }
      return props.filter(p => p.statType === 'ASSISTS' || p.statType === 'TURNOVERS');
    } catch (err) {
      console.warn('[DraftKings] Props API unavailable, using mock data');
      return this.getMockProps();
    }
  }

  // ── Mock data for offline/development mode ────────────────────────────────
  getMockGames(): DKGame[] {
    return [
      { id:'g1', homeTeam:'New York Knicks',    awayTeam:'Indiana Pacers',     commenceTime:'2026-03-17T23:30:00Z', spread:{ home:-6.5, away:+6.5, homeOdds:-110, awayOdds:-110 }, total:{ line:226.5, overOdds:-110, underOdds:-110 }, moneyline:{ home:-260, away:+215 }, source:'DraftKings' },
      { id:'g2', homeTeam:'Milwaukee Bucks',    awayTeam:'Cleveland Cavaliers', commenceTime:'2026-03-18T00:00:00Z', spread:{ home:+5.5, away:-5.5, homeOdds:-110, awayOdds:-110 }, total:{ line:224.0, overOdds:-110, underOdds:-110 }, moneyline:{ home:+190, away:-230 }, source:'DraftKings' },
      { id:'g3', homeTeam:'Minnesota Timberwolves',awayTeam:'Phoenix Suns',    commenceTime:'2026-03-18T00:00:00Z', spread:{ home:-3.5, away:+3.5, homeOdds:-110, awayOdds:-110 }, total:{ line:216.0, overOdds:-110, underOdds:-110 }, moneyline:{ home:-160, away:+135 }, source:'DraftKings' },
      { id:'g4', homeTeam:'Charlotte Hornets',  awayTeam:'Miami Heat',          commenceTime:'2026-03-17T23:00:00Z', spread:{ home:+1.5, away:-1.5, homeOdds:-110, awayOdds:-110 }, total:{ line:218.5, overOdds:-110, underOdds:-110 }, moneyline:{ home:+112, away:-132 }, source:'DraftKings' },
    ];
  }

  getMockProps(): DKPropLine[] {
    return [
      { player:'Tyrese Haliburton', team:'Indiana Pacers',      statType:'ASSISTS', line:9.5,  overOdds:-118, underOdds:-102, gameId:'g1', gameTime:'2026-03-17T23:30:00Z', bookmaker:'DraftKings' },
      { player:'Jalen Brunson',     team:'New York Knicks',      statType:'ASSISTS', line:7.5,  overOdds:-112, underOdds:-108, gameId:'g1', gameTime:'2026-03-17T23:30:00Z', bookmaker:'DraftKings' },
      { player:'Darius Garland',    team:'Cleveland Cavaliers',  statType:'ASSISTS', line:7.5,  overOdds:-115, underOdds:-105, gameId:'g2', gameTime:'2026-03-18T00:00:00Z', bookmaker:'DraftKings' },
      { player:'LaMelo Ball',       team:'Charlotte Hornets',    statType:'ASSISTS', line:8.5,  overOdds:-105, underOdds:-115, gameId:'g4', gameTime:'2026-03-17T23:00:00Z', bookmaker:'DraftKings' },
      { player:'Cade Cunningham',   team:'Detroit Pistons',      statType:'TURNOVERS',line:3.5, overOdds:+110, underOdds:-132, gameId:'g5', gameTime:'2026-03-17T23:00:00Z', bookmaker:'DraftKings' },
      { player:'Damian Lillard',    team:'Milwaukee Bucks',      statType:'ASSISTS', line:6.5,  overOdds:-108, underOdds:-112, gameId:'g2', gameTime:'2026-03-18T00:00:00Z', bookmaker:'DraftKings' },
    ];
  }
}

export const draftKingsService = new DraftKingsService();
export default DraftKingsService;
