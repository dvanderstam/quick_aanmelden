import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { fetchGames } from '../src/icsParser';
import { getAttendanceSummary } from '../src/storage';
import { TEAM_NAME } from '../src/config';
import { Game, Player } from '../src/types';
import { getCurrentPlayer, getAllPlayers, signOut } from '../src/auth';

function formatDate(date: Date): string {
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const months = [
    'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
  ];
  const day = days[date.getDay()];
  const d = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${d} ${month} - ${hours}:${minutes}`;
}

function GameCard({
  game,
  summary,
  onPress,
}: {
  game: Game;
  summary: { present: number; absent: number; uncertain: number; noResponse: number } | null;
  onPress: () => void;
}) {
  const isPast = game.startDate < new Date();

  return (
    <TouchableOpacity
      style={[styles.card, isPast && styles.cardPast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            game.isHome ? styles.badgeHome : styles.badgeAway,
          ]}
        >
          <Text style={styles.badgeText}>{game.isHome ? 'THUIS' : 'UIT'}</Text>
        </View>
        <Text style={[styles.dateText, isPast && styles.textMuted]}>
          {formatDate(game.startDate)}
        </Text>
      </View>

      <Text style={[styles.opponent, isPast && styles.textMuted]}>
        vs {game.opponent}
      </Text>

      <Text style={[styles.location, isPast && styles.textMuted]} numberOfLines={1}>
        📍 {game.location}
      </Text>

      {summary && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryPresent}>✅ {summary.present}</Text>
          <Text style={styles.summaryAbsent}>❌ {summary.absent}</Text>
          <Text style={styles.summaryUncertain}>❓ {summary.uncertain}</Text>
          <Text style={styles.summaryNoResponse}>⬜ {summary.noResponse}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function GamesScreen() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [summaries, setSummaries] = useState<
    Record<string, { present: number; absent: number; uncertain: number; noResponse: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentPlayer().then(setCurrentPlayer);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const loadGames = useCallback(async () => {
    try {
      setError(null);
      const [fetchedPlayers, fetchedGames] = await Promise.all([
        getAllPlayers(),
        fetchGames(),
      ]);
      setPlayers(fetchedPlayers);
      setGames(fetchedGames);

      const pIds = fetchedPlayers.map((p) => p.id);
      const sums: typeof summaries = {};
      for (const g of fetchedGames) {
        sums[g.id] = await getAttendanceSummary(g.id, pIds);
      }
      setSummaries(sums);
    } catch (err) {
      setError('Kon wedstrijden niet laden. Controleer je internetverbinding.');
    }
  }, []);

  useEffect(() => {
    loadGames().finally(() => setLoading(false));
  }, [loadGames]);

  // Refresh summaries when navigating back from a game detail page
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadGames();
      }
    }, [loading, loadGames])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  }, [loadGames]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a3a5c" />
        <Text style={styles.loadingText}>Wedstrijden laden...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); loadGames().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Opnieuw proberen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const now = new Date();
  const upcoming = games.filter((g) => g.startDate >= now);
  const past = games.filter((g) => g.startDate < now);

  return (
    <>
      <Stack.Screen
        options={{
          title: TEAM_NAME + ' - Wedstrijden',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 12 }}>
              <Text style={{ color: '#fff', fontSize: 14 }}>
                {currentPlayer?.name ?? ''} ⏏
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        style={styles.list}
        data={[...upcoming, ...past]}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item, index }) => (
          <>
            {index === 0 && upcoming.length > 0 && (
              <Text style={styles.sectionHeader}>Aankomend</Text>
            )}
            {index === upcoming.length && past.length > 0 && (
              <Text style={styles.sectionHeader}>Gespeeld</Text>
            )}
            <GameCard
              game={item}
              summary={summaries[item.id] || null}
              onPress={() =>
                router.push({
                  pathname: '/game/[id]',
                  params: { id: item.id, data: JSON.stringify(item) },
                })
              }
            />
          </>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>Geen wedstrijden gevonden</Text>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#c0392b',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a3a5c',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardPast: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeHome: {
    backgroundColor: '#27ae60',
  },
  badgeAway: {
    backgroundColor: '#e67e22',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 14,
    color: '#555',
  },
  textMuted: {
    color: '#999',
  },
  opponent: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a3a5c',
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
    color: '#777',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  summaryPresent: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '600',
  },
  summaryAbsent: {
    fontSize: 14,
    color: '#c0392b',
    fontWeight: '600',
  },
  summaryUncertain: {
    fontSize: 14,
    color: '#f39c12',
    fontWeight: '600',
  },
  summaryNoResponse: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
