/**
 * Settings Screen — Agent Configuration
 * Bankroll, limits, API keys, grade filters, auto-betting toggle.
 * All settings persist to SQLite via BetDatabase.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Colors, Shadows, Radius } from '../utils/colors';
import { setSettings, setBankroll, setAgentStatus, setAgentMessage, setLastScanTime } from '../store';
import type { RootState } from '../store';
import { betDatabase } from '../database/BetDatabase';
import { bettingAgent } from '../services/BettingAgent';

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function SettingRow({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.settingRow}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={s.settingLabel}>{label}</Text>
        {hint ? <Text style={s.settingHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function NumericInput({
  value, onChange, prefix = '$', max,
}: { value: number; onChange: (n: number) => void; prefix?: string; max?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <View style={s.numInputWrap}>
      {prefix ? <Text style={s.numInputPrefix}>{prefix}</Text> : null}
      <TextInput
        style={s.numInput}
        value={text}
        onChangeText={t => {
          setText(t);
          const n = parseFloat(t);
          if (!isNaN(n) && n >= 0) onChange(max ? Math.min(max, n) : n);
        }}
        keyboardType="numeric"
        maxLength={7}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const dispatch  = useDispatch();
  const { settings, bankroll, agentStatus, agentMessage } = useSelector((s: RootState) => s.app);
  const [loading, setLoading]   = useState(false);
  const [runningCycle, setRunning] = useState(false);

  // Load settings from DB on mount
  const loadSettings = useCallback(async () => {
    setLoading(true);
    const dbSettings = await betDatabase.getSettings();
    dispatch(setSettings(dbSettings));
    dispatch(setBankroll(dbSettings.bankroll));
    setLoading(false);
  }, [dispatch]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Register agent status listener
  useEffect(() => {
    bettingAgent.onStatusChange((status, msg) => {
      dispatch(setAgentStatus(status));
      dispatch(setAgentMessage(msg));
      if (status === 'idle' || status === 'error') {
        dispatch(setLastScanTime(new Date().toISOString()));
      }
    });
  }, [dispatch]);

  const saveSettings = async (partial: Partial<typeof settings>) => {
    const merged = { ...settings, ...partial };
    dispatch(setSettings(partial));
    await betDatabase.saveSettings(merged);
  };

  const runAgentCycle = async () => {
    if (runningCycle) return;
    setRunning(true);
    try {
      const result = await bettingAgent.runCycle();
      Alert.alert(
        'Agent Cycle Complete',
        `Bets placed: ${result.betsPlaced}\nBets skipped: ${result.betsSkipped}\nTotal staked: $${result.totalStaked}` +
        (result.errors.length ? `\nErrors: ${result.errors.join('; ')}` : '')
      );
    } catch (e) {
      Alert.alert('Agent Error', `${e}`);
    } finally {
      setRunning(false);
    }
  };

  const resetBankroll = () => {
    Alert.alert(
      'Reset Bankroll',
      `Set bankroll to $${settings.bankroll}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            await betDatabase.updateBankroll(settings.bankroll, 0, 'Manual reset');
            dispatch(setBankroll(settings.bankroll));
          },
        },
      ]
    );
  };

  const agentStatusColor: Record<string, string> = {
    idle:     Colors.textTertiary,
    scanning: Colors.blue,
    analyzing:Colors.blue,
    placing:  Colors.gradeB,
    halted:   Colors.gradeC,
    error:    Colors.loss,
  };

  if (loading) return (
    <SafeAreaView style={s.container}>
      <ActivityIndicator style={{ flex: 1 }} color={Colors.blue} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Agent Status Card */}
        <View style={[s.statusCard, Shadows.card]}>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: agentStatusColor[agentStatus] ?? Colors.textTertiary }]} />
            <Text style={[s.statusText, { color: agentStatusColor[agentStatus] }]}>
              {agentStatus.toUpperCase()}
            </Text>
          </View>
          <Text style={s.statusMsg} numberOfLines={2}>{agentMessage}</Text>
          <View style={s.agentBtnRow}>
            <TouchableOpacity
              style={[s.agentBtn, settings.agentEnabled ? s.agentBtnDisable : s.agentBtnEnable]}
              onPress={() => saveSettings({ agentEnabled: !settings.agentEnabled })}
            >
              <Text style={s.agentBtnText}>
                {settings.agentEnabled ? 'DISABLE AGENT' : 'ENABLE AGENT'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.scanBtn, (runningCycle || !settings.agentEnabled) && { opacity: 0.5 }]}
              onPress={runAgentCycle}
              disabled={runningCycle || !settings.agentEnabled}
            >
              {runningCycle
                ? <ActivityIndicator size="small" color={Colors.textOnBlue} />
                : <Text style={s.scanBtnText}>RUN SCAN</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Bankroll */}
        <SectionHeader title="BANKROLL" />
        <View style={[s.card, Shadows.card]}>
          <SettingRow label="Starting Bankroll" hint="Used for Kelly stake sizing">
            <NumericInput
              value={settings.bankroll}
              onChange={v => saveSettings({ bankroll: v })}
              max={100000}
            />
          </SettingRow>
          <View style={s.divider} />
          <View style={s.bankrollRow}>
            <View>
              <Text style={s.bankrollLbl}>CURRENT BALANCE</Text>
              <Text style={s.bankrollVal}>${bankroll.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={s.resetBtn} onPress={resetBankroll}>
              <Text style={s.resetBtnText}>RESET</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Risk Limits */}
        <SectionHeader title="RISK LIMITS" />
        <View style={[s.card, Shadows.card]}>
          <SettingRow label="Max Single Bet" hint="Hard cap per bet ($5–$100)">
            <NumericInput value={settings.maxSingleBet} onChange={v => saveSettings({ maxSingleBet: Math.min(100, Math.max(5, v)) })} max={100} />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="Max Daily Exposure" hint="Stop placing bets after this $$ lost/staked">
            <NumericInput value={settings.maxDailyExposure} onChange={v => saveSettings({ maxDailyExposure: Math.min(500, v) })} max={500} />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="Loss Limit (Responsible Gambling)" hint="Agent halts if daily loss exceeds this">
            <NumericInput value={settings.responsibleGamblingLimit} onChange={v => saveSettings({ responsibleGamblingLimit: v })} max={500} />
          </SettingRow>
        </View>

        {/* Algorithm Thresholds */}
        <SectionHeader title="ALGORITHM THRESHOLDS" />
        <View style={[s.card, Shadows.card]}>
          <SettingRow label="Min Win Probability (%)" hint="Min 70% (training doc hard limit)">
            <NumericInput
              value={settings.minConfidence}
              onChange={v => saveSettings({ minConfidence: Math.max(70, Math.min(95, v)) })}
              prefix="%"
              max={95}
            />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="Min Edge (%)" hint="Min 4% (Grade B threshold)">
            <NumericInput
              value={settings.minEdgePct}
              onChange={v => saveSettings({ minEdgePct: Math.max(2, Math.min(20, v)) })}
              prefix="%"
              max={20}
            />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="Allowed Grades" hint="A = ≥76% conf ≥6% edge  B = ≥70% conf ≥4% edge">
            <View style={s.gradeToggleRow}>
              {(['A','B'] as const).map(g => {
                const active = settings.gradesAllowed.includes(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[s.gradeToggle, active && s.gradeToggleActive]}
                    onPress={() => {
                      const arr = settings.gradesAllowed.split(',').filter(Boolean);
                      const next = active ? arr.filter(x => x !== g) : [...arr, g];
                      if (next.length === 0) return; // always keep at least one
                      saveSettings({ gradesAllowed: next.join(',') });
                    }}
                  >
                    <Text style={[s.gradeToggleText, active && { color: Colors.textOnBlue }]}>
                      Grade {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SettingRow>
        </View>

        {/* Auto-Betting */}
        <SectionHeader title="AUTOMATION" />
        <View style={[s.card, Shadows.card]}>
          <SettingRow
            label="Auto-Place Bets"
            hint="Requires DraftKings Operator API credentials. Use at your own risk."
          >
            <Switch
              value={settings.autoPlaceBets}
              onValueChange={v => {
                if (v) {
                  Alert.alert(
                    'Enable Auto-Betting?',
                    'This will automatically place real bets on DraftKings using your credentials. You are solely responsible for any bets placed.\n\nNational Problem Gambling Helpline: 1-800-522-4700',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Enable', style: 'destructive', onPress: () => saveSettings({ autoPlaceBets: true }) },
                    ]
                  );
                } else {
                  saveSettings({ autoPlaceBets: false });
                }
              }}
              trackColor={{ false: Colors.tanDeep, true: Colors.blue }}
              thumbColor={Colors.textOnBlue}
            />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="The Odds API Key" hint="Get free key at the-odds-api.com (500 req/month)">
            <TextInput
              style={[s.numInput, { minWidth: 120 }]}
              value={settings.oddsApiKey}
              onChangeText={t => saveSettings({ oddsApiKey: t })}
              placeholder="Enter API key"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </SettingRow>
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerTitle}>RESPONSIBLE GAMBLING</Text>
          <Text style={s.disclaimerText}>
            This AI agent facilitates automated sports wagering analysis. Sports betting involves
            risk of financial loss. The CourtIQ algorithm provides statistical predictions only —
            no outcome is guaranteed.{'\n\n'}
            The agent will never:{'\n'}
            • Place bets exceeding your configured loss limits{'\n'}
            • Chase losses with increased stakes{'\n'}
            • Provide false reassurance on losing streaks{'\n\n'}
            National Problem Gambling Helpline:{'\n'}
            <Text style={{ color: Colors.blue, fontWeight: '700' }}>1-800-522-4700</Text>
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  scroll:           { padding: 16, paddingBottom: 40 },
  sectionTitle:     { fontSize: 9, letterSpacing: 2, color: Colors.blue, fontFamily: 'Georgia', marginBottom: 8, marginTop: 16, fontWeight: '700' },
  card:             { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 4 },
  divider:          { height: 1, backgroundColor: Colors.tanMid, marginHorizontal: 14 },
  settingRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  settingLabel:     { fontSize: 13, fontFamily: 'Georgia', color: Colors.textPrimary, fontWeight: '600' },
  settingHint:      { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  numInputWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.tan, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 6 },
  numInputPrefix:   { fontSize: 12, color: Colors.textTertiary, marginRight: 2 },
  numInput:         { fontFamily: 'Courier', fontSize: 14, fontWeight: '700', color: Colors.textPrimary, minWidth: 60 },
  bankrollRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  bankrollLbl:      { fontSize: 9, letterSpacing: 1.5, color: Colors.textTertiary, fontFamily: 'Georgia' },
  bankrollVal:      { fontFamily: 'Georgia', fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  resetBtn:         { backgroundColor: Colors.tanMid, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  resetBtnText:     { fontSize: 11, fontFamily: 'Georgia', color: Colors.textSecondary, letterSpacing: 1 },
  gradeToggleRow:   { flexDirection: 'row', gap: 8 },
  gradeToggle:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.tan },
  gradeToggleActive:{ backgroundColor: Colors.blue, borderColor: Colors.blue },
  gradeToggleText:  { fontSize: 11, fontFamily: 'Georgia', color: Colors.textSecondary, fontWeight: '600' },
  statusCard:       { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 4 },
  statusRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusDot:        { width: 8, height: 8, borderRadius: 4 },
  statusText:       { fontFamily: 'Courier', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  statusMsg:        { fontSize: 11, color: Colors.textSecondary, marginBottom: 12 },
  agentBtnRow:      { flexDirection: 'row', gap: 10 },
  agentBtn:         { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  agentBtnEnable:   { backgroundColor: Colors.blue },
  agentBtnDisable:  { backgroundColor: Colors.tanMid },
  agentBtnText:     { fontFamily: 'Georgia', fontWeight: '700', fontSize: 12, color: Colors.textOnBlue, letterSpacing: 0.5 },
  scanBtn:          { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: Colors.gradeB },
  scanBtnText:      { fontFamily: 'Georgia', fontWeight: '700', fontSize: 12, color: Colors.textOnBlue, letterSpacing: 0.5 },
  disclaimer:       { backgroundColor: Colors.tanMid, borderRadius: Radius.md, padding: 14, marginTop: 20, borderWidth: 1, borderColor: Colors.tanDeep },
  disclaimerTitle:  { fontSize: 9, letterSpacing: 2, color: Colors.textSecondary, fontFamily: 'Georgia', fontWeight: '700', marginBottom: 8 },
  disclaimerText:   { fontSize: 11, color: Colors.textSecondary, lineHeight: 17 },
});
