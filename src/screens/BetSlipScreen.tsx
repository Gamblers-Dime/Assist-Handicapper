/**
 * Bet Slip Screen
 * Review pending AI-recommended bets, adjust stakes, and log placements.
 * Also shows today's placed bets and overall P&L.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Colors, Shadows, Radius, Spacing } from '../utils/colors';
import {
  removeFromBetSlip, updateBetSlipStake, clearBetSlip,
  setBankroll, setLastUpdated, incrementDailyBets,
} from '../store';
import type { RootState } from '../store';
import type { BetSlipItem } from '../store';
import { betDatabase } from '../database/BetDatabase';
import type { BetRecord } from '../database/BetDatabase';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatOdds(o: number) { return o > 0 ? `+${o}` : `${o}`; }
function fmtPnl(n: number | null) {
  if (n === null) return '–';
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toFixed(2);
}

// ── Bet slip item row ─────────────────────────────────────────────────────────
function SlipItemRow({
  item,
  onRemove,
  onStakeChange,
}: {
  item: BetSlipItem;
  onRemove: (id: string) => void;
  onStakeChange: (id: string, stake: number) => void;
}) {
  const [stakeText, setStakeText] = useState(String(item.stake));
  const dirColor = item.direction === 'OVER' ? Colors.blue : Colors.gradeB;
  const gradeColor: Record<string, string> = { A: Colors.blue, B: Colors.gradeB, C: Colors.gradeC, D: Colors.gradeD };

  return (
    <View style={slipStyles.row}>
      {/* Grade + player */}
      <View style={slipStyles.rowTop}>
        <View style={[slipStyles.gradeBadge, { backgroundColor: (gradeColor[item.grade] ?? Colors.gradeD) + '20', borderColor: (gradeColor[item.grade] ?? Colors.gradeD) + '60' }]}>
          <Text style={[slipStyles.gradeText, { color: gradeColor[item.grade] ?? Colors.gradeD }]}>
            {item.grade}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={slipStyles.playerName}>{item.player}</Text>
          <Text style={slipStyles.propMeta}>{item.team} · {item.statType} · {formatOdds(item.odds)}</Text>
        </View>
        <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={slipStyles.removeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Line + direction + confidence */}
      <View style={slipStyles.rowMid}>
        <View style={[slipStyles.dirBox, { backgroundColor: dirColor + '15', borderColor: dirColor + '40' }]}>
          <Text style={[slipStyles.dirText, { color: dirColor }]}>
            {item.direction} {item.line}
          </Text>
        </View>
        <Text style={slipStyles.projText}>Proj: {item.projection}</Text>
        <Text style={[slipStyles.confText, { color: item.confidence >= 76 ? Colors.blue : Colors.blueLight }]}>
          {item.confidence}% conf
        </Text>
        <Text style={slipStyles.edgeText}>{item.edgePct}% edge</Text>
      </View>

      {/* Stake input */}
      <View style={slipStyles.stakeRow}>
        <Text style={slipStyles.stakeLabel}>STAKE ($)</Text>
        <TextInput
          style={slipStyles.stakeInput}
          value={stakeText}
          onChangeText={t => {
            setStakeText(t);
            const n = parseFloat(t);
            if (!isNaN(n) && n > 0) onStakeChange(item.id, Math.min(100, n));
          }}
          keyboardType="numeric"
          maxLength={5}
        />
        <Text style={slipStyles.kellyHint}>Kelly: {item.kellyPct}%</Text>
      </View>
    </View>
  );
}

// ── Settled bet row ───────────────────────────────────────────────────────────
function SettledRow({ bet }: { bet: BetRecord }) {
  const statusColor: Record<string, string> = {
    WON: Colors.win, LOST: Colors.loss, PUSH: Colors.push, CANCELLED: Colors.gradeD, PENDING: Colors.blue,
  };
  const c = statusColor[bet.status] ?? Colors.textTertiary;
  return (
    <View style={histStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={histStyles.player}>{bet.player}</Text>
        <Text style={histStyles.meta}>{bet.direction} {bet.line} · Grade {bet.grade} · ${bet.stake}</Text>
        <Text style={histStyles.date}>{bet.timestamp.slice(0, 10)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[histStyles.statusBadge, { backgroundColor: c + '20' }]}>
          <Text style={[histStyles.statusText, { color: c }]}>{bet.status}</Text>
        </View>
        {bet.pnl !== null && (
          <Text style={[histStyles.pnl, { color: bet.pnl >= 0 ? Colors.win : Colors.loss }]}>
            {fmtPnl(bet.pnl)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BetSlipScreen() {
  const dispatch   = useDispatch();
  const { betSlip, bankroll, dailyStaked } = useSelector((s: RootState) => s.app);

  const [history, setHistory]      = useState<BetRecord[]>([]);
  const [summary, setSummary]      = useState<any>(null);
  const [refreshing, setRefreshing]= useState(false);
  const [placing, setPlacing]      = useState(false);

  const loadHistory = useCallback(async () => {
    const [bets, perf] = await Promise.all([
      betDatabase.getAllBets(30),
      betDatabase.getPerformanceSummary(),
    ]);
    setHistory(bets);
    setSummary(perf);
    const bal = await betDatabase.getBankroll();
    dispatch(setBankroll(bal));
  }, [dispatch]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const placeBets = async () => {
    if (betSlip.length === 0) {
      Alert.alert('No bets in slip', 'Add props from the Today\'s Props tab first.');
      return;
    }
    const totalStake = betSlip.reduce((s, b) => s + b.stake, 0);
    if (totalStake > bankroll) {
      Alert.alert('Insufficient bankroll', `Total stake $${totalStake} exceeds bankroll $${bankroll.toFixed(2)}.`);
      return;
    }
    if (dailyStaked + totalStake > 500) {
      Alert.alert('Daily limit', `Placing these bets would exceed the $500 daily exposure limit.`);
      return;
    }

    Alert.alert(
      'Confirm Bet Placement',
      `Log ${betSlip.length} bet(s) totaling $${totalStake}?\n\nThis records the bets in your local history. Enable autoPlaceBets in Settings to connect to DraftKings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place Bets', style: 'destructive',
          onPress: async () => {
            setPlacing(true);
            try {
              for (const item of betSlip) {
                const record: BetRecord = {
                  id:           `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  timestamp:    new Date().toISOString(),
                  player:       item.player,
                  team:         item.team,
                  opponent:     '',
                  statType:     item.statType as BetRecord['statType'],
                  line:         item.line,
                  direction:    item.direction,
                  odds:         item.odds,
                  stake:        item.stake,
                  confidence:   item.confidence,
                  edgePct:      item.edgePct,
                  kellyPct:     item.kellyPct,
                  grade:        item.grade,
                  projection:   item.projection,
                  gameId:       item.id,
                  bookmaker:    'DraftKings',
                  status:       'PENDING',
                  actualResult: null,
                  pnl:          null,
                  settledAt:    null,
                };
                await betDatabase.insertBet(record);
                dispatch(incrementDailyBets({ staked: item.stake }));
              }

              const newBal = bankroll - totalStake;
              await betDatabase.updateBankroll(newBal, -totalStake, `${betSlip.length} bets placed`);
              dispatch(setBankroll(newBal));
              dispatch(clearBetSlip());
              dispatch(setLastUpdated(new Date().toISOString()));
              await loadHistory();
              Alert.alert('Bets Placed', `${betSlip.length} bet(s) logged successfully.`);
            } finally {
              setPlacing(false);
            }
          },
        },
      ]
    );
  };

  const totalSlipStake = betSlip.reduce((s, b) => s + b.stake, 0);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* Bankroll summary bar */}
        <View style={[s.summaryBar, Shadows.card]}>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>${bankroll.toFixed(0)}</Text>
            <Text style={s.summaryLbl}>BANKROLL</Text>
          </View>
          <View style={[s.summaryItem, s.summaryMid]}>
            <Text style={[s.summaryVal, { color: Colors.blue }]}>{betSlip.length}</Text>
            <Text style={s.summaryLbl}>IN SLIP</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={[s.summaryVal, { color: summary?.totalPnl >= 0 ? Colors.win : Colors.loss }]}>
              {summary ? fmtPnl(summary.totalPnl) : '–'}
            </Text>
            <Text style={s.summaryLbl}>ALL-TIME P&L</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={[s.summaryVal, { color: Colors.win }]}>
              {summary ? `${summary.winRate.toFixed(1)}%` : '–'}
            </Text>
            <Text style={s.summaryLbl}>WIN RATE</Text>
          </View>
        </View>

        {/* Responsible gambling disclaimer */}
        <View style={s.rg}>
          <Text style={s.rgText}>
            ⚠ Sports betting involves risk of financial loss. This tool provides analytical assistance only.
            Never bet more than you can afford to lose.{' '}
            <Text style={{ color: Colors.blue }}>1-800-522-4700</Text>
          </Text>
        </View>

        {/* Current bet slip */}
        <Text style={s.sectionTitle}>PENDING BET SLIP</Text>
        {betSlip.length === 0 ? (
          <View style={[s.emptyCard, Shadows.card]}>
            <Text style={s.emptyText}>No bets in slip</Text>
            <Text style={s.emptySubtext}>Add Grade A/B picks from Today's Props tab</Text>
          </View>
        ) : (
          <View style={[s.slipCard, Shadows.card]}>
            {betSlip.map(item => (
              <SlipItemRow
                key={item.id}
                item={item}
                onRemove={id => dispatch(removeFromBetSlip(id))}
                onStakeChange={(id, stake) => dispatch(updateBetSlipStake({ id, stake }))}
              />
            ))}

            {/* Place button */}
            <View style={s.placeRow}>
              <View>
                <Text style={s.totalLabel}>TOTAL STAKE</Text>
                <Text style={s.totalVal}>${totalSlipStake.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={[s.placeBtn, placing && { opacity: 0.6 }]}
                onPress={placeBets}
                disabled={placing}
              >
                {placing
                  ? <ActivityIndicator color={Colors.textOnBlue} size="small" />
                  : <Text style={s.placeBtnText}>LOG BETS</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent bet history */}
        <Text style={[s.sectionTitle, { marginTop: 20 }]}>RECENT BETS</Text>
        {history.length === 0 ? (
          <View style={[s.emptyCard, Shadows.card]}>
            <Text style={s.emptyText}>No bets logged yet</Text>
          </View>
        ) : (
          <View style={[s.histCard, Shadows.card]}>
            {history.map((bet, i) => (
              <SettledRow key={bet.id} bet={bet} />
            ))}
          </View>
        )}

        {/* Performance summary */}
        {summary && summary.totalBets > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>PERFORMANCE</Text>
            <View style={[s.perfGrid, Shadows.card]}>
              {[
                { label: 'Total Bets', val: String(summary.totalBets) },
                { label: 'Win Rate',   val: `${summary.winRate.toFixed(1)}%` },
                { label: 'ROI',        val: `${summary.roi.toFixed(1)}%` },
                { label: 'Grade A',    val: summary.gradeABets ? `${((summary.gradeAWins/summary.gradeABets)*100).toFixed(0)}%` : '–' },
              ].map((m, i) => (
                <View key={i} style={s.perfItem}>
                  <Text style={s.perfVal}>{m.val}</Text>
                  <Text style={s.perfLbl}>{m.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  scroll:       { padding: 16, paddingBottom: 40 },
  summaryBar:   { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  summaryItem:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  summaryMid:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  summaryVal:   { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  summaryLbl:   { fontSize: 8, color: Colors.textTertiary, letterSpacing: 1, marginTop: 2 },
  rg:           { backgroundColor: Colors.gradeC + '15', borderRadius: Radius.sm, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: Colors.gradeC + '40' },
  rgText:       { fontSize: 10, color: Colors.textSecondary, lineHeight: 14 },
  sectionTitle: { fontSize: 9, letterSpacing: 2, color: Colors.blue, fontFamily: 'Georgia', marginBottom: 8, fontWeight: '700' },
  emptyCard:    { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  emptyText:    { fontFamily: 'Georgia', fontSize: 14, color: Colors.textSecondary },
  emptySubtext: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  slipCard:     { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 8 },
  placeRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.tan },
  totalLabel:   { fontSize: 9, letterSpacing: 1.5, color: Colors.textTertiary, fontFamily: 'Georgia' },
  totalVal:     { fontFamily: 'Georgia', fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  placeBtn:     { backgroundColor: Colors.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md },
  placeBtnText: { color: Colors.textOnBlue, fontFamily: 'Georgia', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  histCard:     { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 8 },
  perfGrid:     { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 8 },
  perfItem:     { flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: Colors.border },
  perfVal:      { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: Colors.blue },
  perfLbl:      { fontSize: 9, color: Colors.textTertiary, letterSpacing: 1, marginTop: 2 },
});

const slipStyles = StyleSheet.create({
  row:         { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.tanMid },
  rowTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  gradeBadge:  { width: 24, height: 24, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gradeText:   { fontSize: 12, fontFamily: 'Georgia', fontWeight: '700' },
  playerName:  { fontFamily: 'Georgia', fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  propMeta:    { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },
  removeBtn:   { fontSize: 16, color: Colors.textTertiary, paddingLeft: 8 },
  rowMid:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  dirBox:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  dirText:     { fontFamily: 'Courier', fontSize: 12, fontWeight: '700' },
  projText:    { fontSize: 11, color: Colors.textSecondary, fontFamily: 'Courier' },
  confText:    { fontSize: 11, fontFamily: 'Courier', fontWeight: '700' },
  edgeText:    { fontSize: 11, color: Colors.gradeB, fontFamily: 'Courier' },
  stakeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stakeLabel:  { fontSize: 9, letterSpacing: 1.5, color: Colors.textTertiary, fontFamily: 'Georgia', minWidth: 54 },
  stakeInput:  { backgroundColor: Colors.tan, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontFamily: 'Courier', fontSize: 14, fontWeight: '700', color: Colors.textPrimary, minWidth: 60 },
  kellyHint:   { fontSize: 10, color: Colors.textTertiary, fontFamily: 'Courier' },
});

const histStyles = StyleSheet.create({
  row:         { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.tanMid, alignItems: 'center' },
  player:      { fontFamily: 'Georgia', fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  meta:        { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  date:        { fontSize: 9, color: Colors.textTertiary, marginTop: 2, fontFamily: 'Courier' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  statusText:  { fontSize: 10, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 0.5 },
  pnl:         { fontFamily: 'Courier', fontSize: 13, fontWeight: '700', marginTop: 3 },
});
