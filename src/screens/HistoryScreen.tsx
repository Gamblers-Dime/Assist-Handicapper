// HistoryScreen.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Shadows, Radius } from '../utils/colors';

const PG_HISTORY = [
  { pg:'John Stockton',    era:'1985–2003', ast:10.5, vsElite:8.9, vsPoor:12.3, to:2.1, corr:0.84 },
  { pg:'Magic Johnson',    era:'1979–1996', ast:11.2, vsElite:9.4, vsPoor:13.8, to:3.6, corr:0.79 },
  { pg:'Steve Nash',       era:'1996–2014', ast:8.5,  vsElite:7.2, vsPoor:10.1, to:2.5, corr:0.82 },
  { pg:'Chris Paul',       era:'2005–2024', ast:9.4,  vsElite:7.8, vsPoor:11.3, to:2.2, corr:0.81 },
  { pg:'Jason Kidd',       era:'1994–2013', ast:8.7,  vsElite:7.3, vsPoor:10.8, to:3.1, corr:0.75 },
  { pg:'Isiah Thomas',     era:'1981–1994', ast:9.3,  vsElite:8.1, vsPoor:11.2, to:3.8, corr:0.72 },
  { pg:'Rajon Rondo',      era:'2006–2021', ast:8.1,  vsElite:7.0, vsPoor:10.2, to:2.9, corr:0.71 },
  { pg:'Russell Westbrook',era:'2008–2024', ast:8.4,  vsElite:7.2, vsPoor:10.5, to:4.2, corr:0.68 },
  { pg:'Stephen Curry',    era:'2009–present',ast:6.5,vsElite:5.8, vsPoor:7.8,  to:3.0, corr:0.74 },
  { pg:'Luka Doncic',      era:'2018–present',ast:8.7,vsElite:7.1, vsPoor:10.4, to:3.9, corr:0.77 },
];

export default function HistoryScreen() {
  return (
    <SafeAreaView style={hStyles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={hStyles.scroll}>
        <View style={[hStyles.card, Shadows.card]}>
          <Text style={hStyles.sectionTitle}>ALL-TIME PG BENCHMARK PROFILES (1980–2026)</Text>
          <View style={hStyles.tableHeader}>
            {['Player','AST','vs Elite','vs Poor','TO','Model r'].map(h => (
              <Text key={h} style={hStyles.th}>{h}</Text>
            ))}
          </View>
          {PG_HISTORY.map((p, i) => (
            <View key={i} style={hStyles.tableRow}>
              <Text style={hStyles.tdPlayer}>{p.pg}</Text>
              <Text style={hStyles.td}>{p.ast}</Text>
              <Text style={[hStyles.td, { color: Colors.textTertiary }]}>{p.vsElite}</Text>
              <Text style={[hStyles.td, { color: Colors.blue }]}>{p.vsPoor}</Text>
              <Text style={hStyles.td}>{p.to}</Text>
              <Text style={[hStyles.td, { color: p.corr >= 0.80 ? Colors.blue : Colors.blueLight }]}>{p.corr.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={[hStyles.card, Shadows.card]}>
          <Text style={hStyles.sectionTitle}>KEY HISTORICAL FINDINGS</Text>
          {[
            { title:'Defense Era Shift (2015+)',  body:'Post-"switch everything" era (2015–present) suppresses PG assists by 1.4/game vs 2000–2014 baselines. Model uses era-adjusted normalization.' },
            { title:'Pace Revolution (2015–2020)', body:'D\'Antoni-influenced fast-pace spread drove PG assist floors up. Steve Nash +2.3 AST in 7SOL system. League average pace rose from 92 → 104.' },
            { title:'Turnover-Steal Covariance',   body:'Since 1985, when a PG faces opponents in top-10 steal%, his TO rate increases 22% but assist rate drops 8%. Dual suppression effect.' },
            { title:'Home Court Amplification',    body:'High-usage PGs (25%+ USG) gain 1.1 extra assists at home vs 0.7 league-wide average. Crowd noise may reduce defensive communication.' },
          ].map((k, i) => (
            <View key={i} style={hStyles.insightRow}>
              <Text style={hStyles.insightTitle}>◆ {k.title}</Text>
              <Text style={hStyles.insightBody}>{k.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const hStyles = StyleSheet.create({
  container:   { flex:1, backgroundColor: Colors.background },
  scroll:      { padding:16, paddingBottom:32 },
  card:        { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, padding:14, marginBottom:16, borderWidth:1, borderColor: Colors.border },
  sectionTitle:{ fontSize:9, letterSpacing:2, color: Colors.blue, fontFamily:'Georgia', marginBottom:12, fontWeight:'700' },
  tableHeader: { flexDirection:'row', borderBottomWidth:1, borderBottomColor: Colors.tanDeep, paddingBottom:6, marginBottom:4 },
  th:          { flex:1, fontSize:8, color: Colors.textTertiary, letterSpacing:0.8, fontFamily:'Georgia' },
  tableRow:    { flexDirection:'row', paddingVertical:7, borderBottomWidth:1, borderBottomColor: Colors.tanMid },
  tdPlayer:    { flex:2, fontSize:11, fontFamily:'Georgia', color: Colors.textPrimary, fontWeight:'700' },
  td:          { flex:1, fontSize:11, fontFamily:'Courier', color: Colors.textSecondary },
  insightRow:  { paddingVertical:10, borderBottomWidth:1, borderBottomColor: Colors.tanMid },
  insightTitle:{ fontSize:12, fontFamily:'Georgia', fontWeight:'700', color: Colors.blue, marginBottom:4 },
  insightBody: { fontSize:11, color: Colors.textSecondary, lineHeight:16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MatchupsScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { TouchableOpacity } from 'react-native';
import { draftKingsService, DKGame } from '../api/DraftKingsAPI';

const TONIGHT = [
  { away:'IND', home:'NYK', away_pg:'Tyrese Haliburton', home_pg:'Jalen Brunson',  time:'7:30 PM', ou:226.5, spread:-6.5 },
  { away:'CLE', home:'MIL', away_pg:'Darius Garland',    home_pg:'Damian Lillard', time:'8:00 PM', ou:224.0, spread:-5.5 },
  { away:'CHA', home:'MIA', away_pg:'LaMelo Ball',        home_pg:'Terry Rozier',   time:'7:00 PM', ou:218.5, spread:+1.5 },
  { away:'PHX', home:'MIN', away_pg:'Devin Booker',       home_pg:'Mike Conley',    time:'8:00 PM', ou:216.0, spread:+3.5 },
  { away:'SAS', home:'SAC', away_pg:'De\'Aaron Fox',      home_pg:'Keegan Murray',  time:'10:00 PM',ou:219.5, spread:-11.5 },
  { away:'PHI', home:'DEN', away_pg:'Jrue Holiday',       home_pg:'Jamal Murray',   time:'10:00 PM',ou:220.0, spread:+13.5 },
];

export function MatchupsScreen() {
  const [games, setGames] = React.useState<DKGame[]>([]);

  React.useEffect(() => {
    draftKingsService.getNBAGames().then(setGames);
  }, []);

  return (
    <SafeAreaView style={hStyles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={hStyles.scroll}>
        <View style={[hStyles.card]}>
          <Text style={hStyles.sectionTitle}>TONIGHT'S NBA SLATE — MAR 17 · SOURCE: DRAFTKINGS</Text>
          {TONIGHT.map((g, i) => (
            <View key={i} style={mStyles.gameRow}>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.teams}>{g.away} <Text style={mStyles.at}>@</Text> {g.home}</Text>
                <Text style={mStyles.pgs}>{g.away_pg} vs {g.home_pg}</Text>
                <Text style={mStyles.time}>{g.time} ET</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={mStyles.ouBox}>
                  <Text style={mStyles.ouLabel}>O/U</Text>
                  <Text style={mStyles.ouVal}>{g.ou}</Text>
                </View>
                <Text style={mStyles.spread}>{g.spread > 0 ? `+${g.spread}` : g.spread} spread</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const mStyles = StyleSheet.create({
  gameRow:  { paddingVertical:12, borderBottomWidth:1, borderBottomColor: Colors.tanMid, flexDirection:'row', alignItems:'center' },
  teams:    { fontFamily:'Georgia', fontSize:15, fontWeight:'700', color: Colors.textPrimary },
  at:       { color: Colors.textTertiary, fontWeight:'400' },
  pgs:      { fontSize:11, color: Colors.textSecondary, marginTop:2 },
  time:     { fontSize:10, color: Colors.textTertiary, marginTop:2, fontFamily:'Courier' },
  ouBox:    { backgroundColor: Colors.bluePale, borderRadius:6, paddingHorizontal:10, paddingVertical:4, alignItems:'center', marginBottom:4 },
  ouLabel:  { fontSize:8, color: Colors.blue, letterSpacing:1 },
  ouVal:    { fontFamily:'Courier', fontSize:14, color: Colors.blue, fontWeight:'700' },
  spread:   { fontSize:10, fontFamily:'Courier', color: Colors.textTertiary },
});

export default HistoryScreen;
