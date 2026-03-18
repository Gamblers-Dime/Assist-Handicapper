/**
 * Tonight's NBA Slate — Matchups Screen
 * Shows tonight's games with PG matchups, spreads, and O/U totals.
 * Pulls live data from DraftKings/The Odds API with static fallback.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Shadows, Radius } from '../utils/colors';
import { draftKingsService, DKGame } from '../api/DraftKingsAPI';

interface SlateGame {
  away:     string;
  home:     string;
  away_pg:  string;
  home_pg:  string;
  time:     string;
  ou:       number;
  spread:   number;
  gameId?:  string;
}

const STATIC_SLATE: SlateGame[] = [
  { away:'IND', home:'NYK', away_pg:'Tyrese Haliburton', home_pg:'Jalen Brunson',   time:'7:30 PM',  ou:226.5, spread:-6.5 },
  { away:'CLE', home:'MIL', away_pg:'Darius Garland',    home_pg:'Damian Lillard',  time:'8:00 PM',  ou:224.0, spread:-5.5 },
  { away:'CHA', home:'MIA', away_pg:'LaMelo Ball',        home_pg:'Terry Rozier',    time:'7:00 PM',  ou:218.5, spread:+1.5 },
  { away:'PHX', home:'MIN', away_pg:'Devin Booker',       home_pg:'Mike Conley',     time:'8:00 PM',  ou:216.0, spread:+3.5 },
  { away:'SAS', home:'SAC', away_pg:"De'Aaron Fox",       home_pg:'Keegan Murray',   time:'10:00 PM', ou:219.5, spread:-11.5 },
  { away:'PHI', home:'DEN', away_pg:'Jrue Holiday',       home_pg:'Jamal Murray',    time:'10:00 PM', ou:220.0, spread:+13.5 },
];

function mapLiveGames(live: DKGame[]): SlateGame[] {
  return live.map(g => ({
    away:     g.awayTeam.split(' ').pop()!.slice(0, 3).toUpperCase(),
    home:     g.homeTeam.split(' ').pop()!.slice(0, 3).toUpperCase(),
    away_pg:  '',
    home_pg:  '',
    time:     new Date(g.commenceTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    ou:       g.total.line,
    spread:   g.spread.home,
    gameId:   g.id,
  }));
}

export default function MatchupsScreen() {
  const [slate, setSlate]       = useState<SlateGame[]>(STATIC_SLATE);
  const [refreshing, setRefresh]= useState(false);
  const [source, setSource]     = useState<'live' | 'static'>('static');

  const loadGames = async () => {
    setRefresh(true);
    try {
      const live = await draftKingsService.getNBAGames();
      if (live.length > 0) {
        const mapped = mapLiveGames(live);
        // Merge static PG names where live API doesn't provide them
        const merged = mapped.map((g, i) => ({
          ...g,
          away_pg: STATIC_SLATE[i]?.away_pg ?? '',
          home_pg: STATIC_SLATE[i]?.home_pg ?? '',
        }));
        setSlate(merged);
        setSource('live');
      }
    } catch {
      // keep static
    }
    setRefresh(false);
  };

  useEffect(() => { loadGames(); }, []);

  const today = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadGames} tintColor={Colors.blue} />}
      >
        {/* Header info bar */}
        <View style={s.infoBar}>
          <Text style={s.infoDate}>{today.toUpperCase()} NBA SLATE</Text>
          <View style={[s.sourceBadge, { backgroundColor: source === 'live' ? Colors.win + '20' : Colors.tanMid }]}>
            <Text style={[s.sourceText, { color: source === 'live' ? Colors.win : Colors.textTertiary }]}>
              {source === 'live' ? '● LIVE' : '○ CACHED'}
            </Text>
          </View>
        </View>

        {/* Games */}
        <View style={[s.card, Shadows.card]}>
          {slate.map((g, i) => (
            <View key={i} style={[s.gameRow, i === slate.length - 1 && { borderBottomWidth: 0 }]}>

              {/* Left: teams + PG names + time */}
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={s.teamsRow}>
                  <Text style={s.teamAway}>{g.away}</Text>
                  <Text style={s.at}> @ </Text>
                  <Text style={s.teamHome}>{g.home}</Text>
                </View>
                {g.away_pg || g.home_pg ? (
                  <Text style={s.pgs} numberOfLines={1}>
                    {g.away_pg || '—'}{' '}
                    <Text style={s.vsText}>vs</Text>{' '}
                    {g.home_pg || '—'}
                  </Text>
                ) : null}
                <Text style={s.time}>{g.time} ET</Text>
              </View>

              {/* Right: spread + O/U */}
              <View style={s.oddsCol}>
                <View style={s.ouBox}>
                  <Text style={s.ouLabel}>O/U</Text>
                  <Text style={s.ouVal}>{g.ou}</Text>
                </View>
                <Text style={s.spread}>
                  {g.spread === 0 ? 'PK' : g.spread > 0 ? `+${g.spread}` : `${g.spread}`}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Legend */}
        <Text style={s.legend}>
          Spread shown for home team. Pull to refresh for live DraftKings lines.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll:    { padding: 16, paddingBottom: 32 },
  infoBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  infoDate:  { fontSize: 9, letterSpacing: 2, color: Colors.blue, fontFamily: 'Georgia', fontWeight: '700' },
  sourceBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  sourceText: { fontSize: 9, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 0.5 },
  card:       { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  gameRow:    { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.tanMid, flexDirection: 'row', alignItems: 'center' },
  teamsRow:   { flexDirection: 'row', alignItems: 'baseline', marginBottom: 3 },
  teamAway:   { fontFamily: 'Georgia', fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  at:         { fontSize: 13, color: Colors.textTertiary },
  teamHome:   { fontFamily: 'Georgia', fontSize: 16, fontWeight: '700', color: Colors.blue },
  pgs:        { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  vsText:     { color: Colors.textTertiary },
  time:       { fontSize: 10, color: Colors.textTertiary, fontFamily: 'Courier' },
  oddsCol:    { alignItems: 'flex-end', minWidth: 70 },
  ouBox:      { backgroundColor: Colors.bluePale, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', marginBottom: 4 },
  ouLabel:    { fontSize: 8, color: Colors.blue, letterSpacing: 1, fontFamily: 'Georgia' },
  ouVal:      { fontFamily: 'Courier', fontSize: 15, color: Colors.blue, fontWeight: '700' },
  spread:     { fontSize: 11, fontFamily: 'Courier', color: Colors.textTertiary },
  legend:     { fontSize: 10, color: Colors.textTertiary, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
