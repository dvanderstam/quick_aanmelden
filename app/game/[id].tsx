import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { AttendanceStatus, Game, Player } from '../../src/types';
import {
  getAllAttendanceForGame,
  setAttendance,
} from '../../src/storage';
import { getCurrentPlayer, canEditPlayer, getAllPlayers } from '../../src/auth';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; emoji: string }[] = [
  { value: 'present', label: 'Aanwezig', emoji: '✅' },
  { value: 'absent', label: 'Afwezig', emoji: '❌' },
  { value: 'uncertain', label: 'Onzeker', emoji: '❓' },
];

function formatFullDate(date: Date): string {
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ];
  const day = days[date.getDay()];
  const d = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${d} ${month} om ${hours}:${minutes}`;
}

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
}

export default function GameDetailScreen() {
  const params = useLocalSearchParams<{ id: string; data: string }>();
  const game: Game | null = params.data
    ? (() => {
        const parsed = JSON.parse(params.data);
        return {
          ...parsed,
          startDate: new Date(parsed.startDate),
          endDate: new Date(parsed.endDate),
        };
      })()
    : null;

  const gameId = params.id;
  const [attendance, setAttendanceState] = useState<Record<number, AttendanceStatus>>({});
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const loadData = useCallback(async () => {
    if (!gameId) return;
    const [fetchedPlayers] = await Promise.all([getAllPlayers()]);
    setPlayers(fetchedPlayers);
    const playerIds = fetchedPlayers.map((p) => p.id);
    const result = await getAllAttendanceForGame(gameId, playerIds);
    setAttendanceState(result);
  }, [gameId]);

  useEffect(() => {
    loadData();
    getCurrentPlayer().then(setCurrentPlayer);
  }, [loadData]);

  const handleToggle = async (playerId: number) => {
    const current = attendance[playerId] || null;
    const order: AttendanceStatus[] = [null, 'present', 'absent', 'uncertain'];
    const nextIndex = (order.indexOf(current) + 1) % order.length;
    const next = order[nextIndex];

    await setAttendance(gameId, playerId, next);
    setAttendanceState((prev) => ({ ...prev, [playerId]: next }));
  };

  const handleSetStatus = async (playerId: number, status: AttendanceStatus) => {
    const current = attendance[playerId];
    const newStatus = current === status ? null : status;
    await setAttendance(gameId, playerId, newStatus);
    setAttendanceState((prev) => ({ ...prev, [playerId]: newStatus }));
  };

  if (!game) {
    return (
      <View style={styles.center}>
        <Text>Wedstrijd niet gevonden</Text>
      </View>
    );
  }

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendance).filter((s) => s === 'absent').length;
  const uncertainCount = Object.values(attendance).filter((s) => s === 'uncertain').length;

  return (
    <>
      <Stack.Screen
        options={{ title: `vs ${game.opponent}` }}
      />
      <FlatList
        style={styles.container}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.matchInfo}>
              <View
                style={[
                  styles.badge,
                  game.isHome ? styles.badgeHome : styles.badgeAway,
                ]}
              >
                <Text style={styles.badgeText}>
                  {game.isHome ? 'THUISWEDSTRIJD' : 'UITWEDSTRIJD'}
                </Text>
              </View>
              <Text style={styles.opponentText}>vs {game.opponent}</Text>
              <Text style={styles.dateText}>{formatFullDate(game.startDate)}</Text>

              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => openMaps(game.location)}
              >
                <Text style={styles.locationText}>📍 {game.location}</Text>
                <Text style={styles.locationHint}>Tik om te navigeren</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryBar}>
              <View style={[styles.summaryItem, styles.summaryGreen]}>
                <Text style={styles.summaryNumber}>{presentCount}</Text>
                <Text style={styles.summaryLabel}>Aanwezig</Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryRed]}>
                <Text style={styles.summaryNumber}>{absentCount}</Text>
                <Text style={styles.summaryLabel}>Afwezig</Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryOrange]}>
                <Text style={styles.summaryNumber}>{uncertainCount}</Text>
                <Text style={styles.summaryLabel}>Onzeker</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Spelers</Text>
          </View>
        }
        data={players}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item: player }) => {
          const status = attendance[player.id] || null;
          const editable = currentPlayer ? canEditPlayer(currentPlayer, player.id) : false;
          return (
            <View style={[styles.playerRow, !editable && styles.playerRowDisabled]}>
              <View style={styles.playerInfo}>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarText}>
                    {player.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.playerName}>{player.name}</Text>
              </View>
              <View style={styles.statusButtons}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    disabled={!editable}
                    style={[
                      styles.statusBtn,
                      status === opt.value && styles.statusBtnActive,
                      status === opt.value &&
                        opt.value === 'present' && styles.statusBtnPresent,
                      status === opt.value &&
                        opt.value === 'absent' && styles.statusBtnAbsent,
                      status === opt.value &&
                        opt.value === 'uncertain' && styles.statusBtnUncertain,
                      !editable && styles.statusBtnDisabled,
                    ]}
                    onPress={() => handleSetStatus(player.id, opt.value)}
                  >
                    <Text style={[styles.statusEmoji, !editable && styles.statusEmojiDisabled]}>{opt.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 8,
  },
  matchInfo: {
    backgroundColor: '#1a3a5c',
    padding: 20,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
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
    letterSpacing: 1,
  },
  opponentText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#b0c4de',
    marginBottom: 12,
  },
  locationButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
  },
  locationHint: {
    color: '#b0c4de',
    fontSize: 12,
    marginTop: 2,
  },
  summaryBar: {
    flexDirection: 'row',
    margin: 16,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryGreen: {
    backgroundColor: '#e8f5e9',
  },
  summaryRed: {
    backgroundColor: '#fce4ec',
  },
  summaryOrange: {
    backgroundColor: '#fff8e1',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a3a5c',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a3a5c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  playerName: {
    fontSize: 16,
    color: '#333',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statusBtnActive: {
    borderWidth: 2,
  },
  statusBtnPresent: {
    backgroundColor: '#e8f5e9',
    borderColor: '#27ae60',
  },
  statusBtnAbsent: {
    backgroundColor: '#fce4ec',
    borderColor: '#c0392b',
  },
  statusBtnUncertain: {
    backgroundColor: '#fff8e1',
    borderColor: '#f39c12',
  },
  statusEmoji: {
    fontSize: 18,
  },
  playerRowDisabled: {
    opacity: 0.6,
  },
  statusBtnDisabled: {
    opacity: 0.4,
  },
  statusEmojiDisabled: {
    opacity: 0.4,
  },
  separator: {
    height: 4,
  },
});
