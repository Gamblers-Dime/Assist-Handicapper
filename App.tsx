/**
 * CourtIQ — Basketball-IQ Android App
 * React Native 0.76.5
 *
 * Navigation: 6-tab bottom nav
 *   Props | Matchups | Bet Slip | Algorithm | Backtest | History
 *
 * Architecture:
 *  - Redux (app state, bankroll, bet slip, agent status)
 *  - SQLite (persistent bet history via BetDatabase)
 *  - BettingAgent (autonomous monitoring & placement)
 */

import React, { useEffect } from 'react';
import { StatusBar, View, Text } from 'react-native';
import { NavigationContainer }  from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider, useDispatch }   from 'react-redux';
import { SafeAreaProvider }        from 'react-native-safe-area-context';

import { store }          from './src/store';
import { Colors }         from './src/utils/colors';
import { betDatabase }    from './src/database/BetDatabase';
import { setBankroll, setAgentStatus } from './src/store';

import PropsScreen      from './src/screens/PropsScreen';
import MatchupsScreen   from './src/screens/MatchupsScreen';
import BetSlipScreen    from './src/screens/BetSlipScreen';
import AlgorithmScreen  from './src/screens/AlgorithmScreen';
import BacktestScreen   from './src/screens/BacktestScreen';
import HistoryScreen    from './src/screens/HistoryScreen';
import SettingsScreen   from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

// ── Tab Icon (text-based, swap for react-native-vector-icons in production) ──
function TabIcon({ name, focused, badge }: { name: string; focused: boolean; badge?: number }) {
  const iconMap: Record<string, string> = {
    Props:     '◉',
    Matchups:  '⬡',
    'Bet Slip':'◈',
    Algorithm: '⊞',
    Backtest:  '▦',
    'PG Data': '▤',
    Settings:  '⊛',
  };
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 36, height: 30 }}>
      <View style={{
        width: 28, height: 28, borderRadius: 7,
        backgroundColor: focused ? Colors.bluePale : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 14, color: focused ? Colors.blue : Colors.textTertiary }}>
          {iconMap[name] ?? '●'}
        </Text>
      </View>
      {badge && badge > 0 ? (
        <View style={{
          position: 'absolute', top: 0, right: 0,
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 8, color: '#FFF', fontWeight: '700' }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── App initializer — loads DB, restores bankroll ─────────────────────────────
function AppInit({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      try {
        await betDatabase.init();
        const bankroll = await betDatabase.getBankroll();
        dispatch(setBankroll(bankroll));
        dispatch(setAgentStatus('idle'));
      } catch (e) {
        console.warn('[AppInit] DB init error:', e);
      }
    })();
  }, [dispatch]);

  return <>{children}</>;
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppInit>
          <NavigationContainer>
            <StatusBar backgroundColor={Colors.blueDark} barStyle="light-content" />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
                tabBarActiveTintColor:   Colors.blue,
                tabBarInactiveTintColor: Colors.textTertiary,
                tabBarStyle: {
                  backgroundColor: Colors.surfaceElevated,
                  borderTopColor:  Colors.border,
                  borderTopWidth:  1,
                  height: 62,
                  paddingBottom: 6,
                  paddingTop: 4,
                },
                tabBarLabelStyle: {
                  fontFamily: 'Georgia',
                  fontSize: 10,
                  fontWeight: '600',
                },
                headerStyle: {
                  backgroundColor: Colors.blueDark,
                  shadowColor:     'transparent',
                  elevation:       0,
                },
                headerTintColor:      Colors.textOnBlue,
                headerTitleStyle: {
                  fontFamily:   'Georgia',
                  fontWeight:   '700',
                  fontSize:     16,
                },
              })}
            >
              <Tab.Screen
                name="Props"
                component={PropsScreen}
                options={{ title: "Today's Props", headerTitle: 'PG Props' }}
              />
              <Tab.Screen
                name="Matchups"
                component={MatchupsScreen}
                options={{ title: 'Matchups', headerTitle: "Tonight's NBA Slate" }}
              />
              <Tab.Screen
                name="Bet Slip"
                component={BetSlipScreen}
                options={{ title: 'Bet Slip', headerTitle: 'Bet Slip' }}
              />
              <Tab.Screen
                name="Algorithm"
                component={AlgorithmScreen}
                options={{ title: 'Algorithm', headerTitle: 'Prediction Model' }}
              />
              <Tab.Screen
                name="Backtest"
                component={BacktestScreen}
                options={{ title: 'Backtest', headerTitle: 'Historical Performance' }}
              />
              <Tab.Screen
                name="PG Data"
                component={HistoryScreen}
                options={{ title: 'PG Data', headerTitle: 'PG Historical Database' }}
              />
              <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings', headerTitle: 'Agent Settings' }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        </AppInit>
      </SafeAreaProvider>
    </Provider>
  );
}
