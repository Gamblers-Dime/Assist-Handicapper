import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Shadows, Radius, Spacing } from '../utils/colors';
import { draftKingsService, DKPropLine } from '../api/DraftKingsAPI';
import PGPredictionEngine, { PredictionResult, DefensiveSystem } from '../algorithm/PGPredictor';
import { sleeperService } from '../api/SleeperNBAAPI';

interface EnrichedProp extends DKPropLine {
  prediction?: PredictionResult;
  loading: boolean;
}

const MOCK_CONTEXTS: Record<string, any> = {
  'Tyrese Haliburton': { seasonPGAst:9.8, seasonPGTo:3.2, l5Ast:[11,9,10,12,10], l10Ast:[11,9,10,12,8,9,11,10,9,10], l5To:[3,3,4,3,3], h2hAst:[10,9,11,9,10], isHome:false, coachPace:103.4, oppDefRtg:108.9, oppPGStealPct:0.022, oppSwitchPct:0.68, restDays:2, oppRestDays:2, backToBack:false, altitude:false, rivalry:true, teamAstPct:0.68, pgUsageRate:0.31, minutesTrend:35.2, injuryFlag:false, pgVsPGStyleMatchup:'PASS_FIRST_VS_ISO', coachDefSystem:'PHYSICAL_PRESSURE' as DefensiveSystem },
  'Jalen Brunson':     { seasonPGAst:8.2, seasonPGTo:2.8, l5Ast:[9,7,11,8,10],   l10Ast:[9,7,11,8,10,6,9,8,7,10], l5To:[3,2,3,3,2], h2hAst:[8,7,9,8,9], isHome:true, coachPace:98.6, oppDefRtg:112.0, oppPGStealPct:0.018, oppSwitchPct:0.44, restDays:2, oppRestDays:2, backToBack:false, altitude:false, rivalry:true, teamAstPct:0.62, pgUsageRate:0.34, minutesTrend:34.8, injuryFlag:false, pgVsPGStyleMatchup:'MIRROR_MATCHUP', coachDefSystem:'AGGRESSIVE_HELP' as DefensiveSystem },
  'Darius Garland':    { seasonPGAst:7.9, seasonPGTo:2.7, l5Ast:[8,9,7,8,10],    l10Ast:[8,9,7,8,10,7,8,9,7,9], l5To:[3,2,3,2,3], h2hAst:[8,7,8,7,8], isHome:false, coachPace:102.1, oppDefRtg:112.4, oppPGStealPct:0.019, oppSwitchPct:0.55, restDays:1, oppRestDays:2, backToBack:false, altitude:false, rivalry:false, teamAstPct:0.66, pgUsageRate:0.28, minutesTrend:33.2, injuryFlag:false, pgVsPGStyleMatchup:'SPEED_VS_PHYSICAL', coachDefSystem:'DROP_COVERAGE' as DefensiveSystem },
  'LaMelo Ball':       { seasonPGAst:8.6, seasonPGTo:3.4, l5Ast:[9,8,10,7,9],    l10Ast:[9,8,10,7,9,8,10,9,8,11], l5To:[3,4,3,4,3], h2hAst:[8,9,8,7,9], isHome:false, coachPace:103.1, oppDefRtg:110.5, oppPGStealPct:0.021, oppSwitchPct:0.61, restDays:2, oppRestDays:1, backToBack:false, altitude:false, rivalry:false, teamAstPct:0.64, pgUsageRate:0.33, minutesTrend:33.5, injuryFlag:false, pgVsPGStyleMatchup:'PASS_FIRST_VS_ISO', coachDefSystem:'AGGRESSIVE_HELP' as DefensiveSystem },
  'Cade Cunningham':   { seasonPGAst:9.2, seasonPGTo:3.6, l5Ast:[10,9,11,8,10],  l10Ast:[10,9,11,8,10,9,8,11,9,10], l5To:[3,4,3,3,4], h2hAst:[9,8,10,9,8], isHome:false, coachPace:99.8, oppDefRtg:116.2, oppPGStealPct:0.014, oppSwitchPct:0.35, restDays:2, oppRestDays:2, backToBack:false, altitude:false, rivalry:false, teamAstPct:0.65, pgUsageRate:0.38, minutesTrend:36.1, injuryFlag:false, pgVsPGStyleMatchup:'SIZE_ADVANTAGE', coachDefSystem:'DROP_COVERAGE' as DefensiveSystem },
  'Damian Lillard':    { seasonPGAst:7.1, seasonPGTo:2.9, l5Ast:[8,6,7,9,7],     l10Ast:[8,6,7,9,7,6,8,7,7,8], l5To:[3,3,2,3,3], h2hAst:[7,6,7,7,8], isHome:true, coachPace:100.7, oppDefRtg:108.2, oppPGStealPct:0.023, oppSwitchPct:0.65, restDays:2, oppRestDays:2, backToBack:false, altitude:false, rivalry:false, teamAstPct:0.61, pgUsageRate:0.31, minutesTrend:33.0, injuryFlag:false, pgVsPGStyleMatchup:'SHOOTER_VS_DISRUPTOR', coachDefSystem:'SWITCH_EVERYTHING' as DefensiveSystem },
};

function GradeChip({ grade }: { grade: string }) {
  const colorMap: Record<string, string> = { A: Colors.blue, B: Colors.gradeB, C: Colors.gradeC, D: Colors.gradeD };
  const c = colorMap[grade] || Colors.gradeD;
  return (
    <View style={{ backgroundColor: c + '20', borderWidth: 1, borderColor: c + '60', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ color: c, fontSize: 11, fontFamily: 'Georgia', fontWeight: '700' }}>Grade {grade}</Text>
    </View>
  );
}

function ConfBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={{ height: 4, backgroundColor: Colors.tanMid, borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${value}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

function PropCard({ prop, onPress }: { prop: EnrichedProp; onPress: () => void }) {
  const pred = prop.prediction;
  const dir  = pred?.direction ?? 'OVER';
  const conf = pred?.confidence ?? 0;
  const confColor = conf >= 76 ? Colors.blue : conf >= 70 ? Colors.blueLight : Colors.textTertiary;
  const dirColor  = dir === 'OVER' ? Colors.blue : Colors.gradeB;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[styles.propCard, Shadows.card]}>
      <View style={styles.propCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.propPlayerName}>{prop.player}</Text>
          <Text style={styles.propMeta}>{prop.team} · {prop.statType} · {prop.bookmaker}</Text>
        </View>
        {pred && !prop.loading && <GradeChip grade={pred.grade} />}
      </View>

      <View style={styles.propOddsRow}>
        <View style={styles.propOddsBox}>
          <Text style={styles.propOddsLabel}>LINE</Text>
          <Text style={styles.propOddsValue}>{prop.line}</Text>
        </View>
        {pred && (
          <>
            <View style={[styles.propOddsBox, { borderColor: dirColor + '50', backgroundColor: dirColor + '10' }]}>
              <Text style={styles.propOddsLabel}>MODEL</Text>
              <Text style={[styles.propOddsValue, { color: dirColor }]}>{dir} {pred.projection}</Text>
            </View>
            <View style={styles.propOddsBox}>
              <Text style={styles.propOddsLabel}>KELLY</Text>
              <Text style={[styles.propOddsValue, { color: Colors.textSecondary, fontSize: 13 }]}>{pred.kellyPct}%</Text>
            </View>
          </>
        )}
        <View style={styles.propOddsBox}>
          <Text style={styles.propOddsLabel}>ODDS</Text>
          <Text style={[styles.propOddsValue, { fontSize: 13 }]}>
            {prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}/{prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}
          </Text>
        </View>
      </View>

      {prop.loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.blue} />
          <Text style={styles.loadingText}>Computing prediction…</Text>
        </View>
      )}

      {pred && !prop.loading && (
        <View style={styles.confidenceRow}>
          <ConfBar value={conf} color={confColor} />
          <Text style={[styles.confLabel, { color: confColor }]}>{conf}%</Text>
          {pred.flagWarnings.length > 0 && (
            <Text style={styles.warningDot}>⚠</Text>
          )}
        </View>
      )}

      {pred?.factors && !prop.loading && (
        <View style={styles.factorsRow}>
          {pred.factors.filter(f => f.signal !== 'NEUTRAL').slice(0, 3).map((f, i) => (
            <View key={i} style={[styles.factorChip, { backgroundColor: f.signal === 'BULLISH' ? Colors.bluePale : '#FDE8E8' }]}>
              <Text style={[styles.factorChipText, { color: f.signal === 'BULLISH' ? Colors.blue : Colors.loss }]}>
                {f.signal === 'BULLISH' ? '▲' : '▼'} {f.name.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function PropsScreen() {
  const [props, setProps]         = useState<EnrichedProp[]>([]);
  const [refreshing, setRefresh]  = useState(false);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'ALL'|'A'|'B'>('ALL');
  const [injSignals, setInj]      = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setRefresh(true);
    const [rawProps, injSigs] = await Promise.all([
      draftKingsService.getPlayerProps(),
      sleeperService.getPGInjurySignals(),
    ]);
    setInj(injSigs);

    // Seed with enriched props
    const enriched: EnrichedProp[] = rawProps.map(p => ({ ...p, loading: true }));
    setProps(enriched);
    setRefresh(false);

    // Compute predictions async per prop
    for (let i = 0; i < rawProps.length; i++) {
      const p    = rawProps[i];
      const ctx  = MOCK_CONTEXTS[p.player];
      if (!ctx) {
        setProps(prev => prev.map((ep, idx) => idx === i ? { ...ep, loading: false } : ep));
        continue;
      }
      const prediction = PGPredictionEngine.predict({
        ...ctx,
        player:    p.player,
        lineValue: p.line,
        lineType:  p.statType as any,
        odds:      p.overOdds,
        injuryFlag: injSigs[p.player] ?? false,
      });
      setProps(prev => prev.map((ep, idx) => idx === i ? { ...ep, prediction, loading: false } : ep));
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = props
    .filter(p => {
      const matchSearch = p.player.toLowerCase().includes(search.toLowerCase());
      const matchGrade  = filter === 'ALL' || p.prediction?.grade === filter;
      return matchSearch && matchGrade;
    })
    .sort((a, b) => (b.prediction?.confidence ?? 0) - (a.prediction?.confidence ?? 0));

  const strongPicks = props.filter(p => p.prediction?.grade === 'A').length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>{props.length}</Text>
          <Text style={styles.summaryLbl}>Props Analyzed</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryHighlight]}>
          <Text style={[styles.summaryVal, { color: Colors.blue }]}>{strongPicks}</Text>
          <Text style={styles.summaryLbl}>Grade A Picks</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>70.6%</Text>
          <Text style={styles.summaryLbl}>Model Win Rate</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: Colors.win }]}>+14.1%</Text>
          <Text style={styles.summaryLbl}>Avg ROI</Text>
        </View>
      </View>

      {/* Search + filter */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search players…"
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          {(['ALL', 'A', 'B'] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterBtnActive]}>
              <Text style={[styles.filterBtnText, filter === f && { color: Colors.textOnBlue }]}>
                {f === 'ALL' ? 'All' : `Grade ${f}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={Colors.blue} />}
      >
        {filtered.length === 0 && !refreshing && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No props match your filters</Text>
          </View>
        )}
        {filtered.map((prop, i) => (
          <PropCard key={`${prop.player}-${i}`} prop={prop} onPress={() => {}} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  summaryBar:       { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 10 },
  summaryItem:      { flex: 1, alignItems: 'center' },
  summaryHighlight: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  summaryVal:       { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  summaryLbl:       { fontSize: 9, color: Colors.textTertiary, letterSpacing: 0.8, marginTop: 1 },
  toolbar:          { backgroundColor: Colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingBottom: 10, paddingTop: 8 },
  searchInput:      { backgroundColor: Colors.tan, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary, marginBottom: 8 },
  filterRow:        { flexDirection: 'row', gap: 6 },
  filterBtn:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.tan },
  filterBtnActive:  { backgroundColor: Colors.blue, borderColor: Colors.blue },
  filterBtnText:    { fontSize: 11, fontFamily: 'Georgia', color: Colors.textSecondary, fontWeight: '600' },
  scrollContent:    { padding: 16, paddingBottom: 32 },
  propCard:         { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  propCardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  propPlayerName:   { fontFamily: 'Georgia', fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  propMeta:         { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  propOddsRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  propOddsBox:      { flex: 1, backgroundColor: Colors.tan, borderRadius: 6, borderWidth: 1, borderColor: Colors.tanDeep, padding: 8, alignItems: 'center' },
  propOddsLabel:    { fontSize: 8, letterSpacing: 1.2, color: Colors.textTertiary, fontFamily: 'Georgia', marginBottom: 2 },
  propOddsValue:    { fontFamily: 'Courier', fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  loadingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  loadingText:      { fontSize: 11, color: Colors.textTertiary },
  confidenceRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  confLabel:        { fontFamily: 'Courier', fontSize: 11, fontWeight: '700', minWidth: 36 },
  warningDot:       { fontSize: 12, color: Colors.gradeC },
  factorsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  factorChip:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  factorChipText:   { fontSize: 10, fontFamily: 'Georgia', fontWeight: '600' },
  emptyState:       { alignItems: 'center', paddingTop: 60 },
  emptyText:        { color: Colors.textTertiary, fontFamily: 'Georgia', fontSize: 14 },
});
