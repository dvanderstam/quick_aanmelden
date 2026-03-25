import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchGames } from '../src/icsParser';
import { getAttendanceSummary } from '../src/storage';
import { TEAMS, TeamConfig, QUICK_LOGO_URL, TEAM_NAME } from '../src/config';
import { Game, Player } from '../src/types';
import { getCurrentPlayer, getPlayersForTeam, signOut } from '../src/auth';
import { M3, radii, spacing, typography } from '../src/theme';
import { DisclaimerFooter } from '../src/DisclaimerFooter';

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

function formatCountdown(target: Date): string {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Nu!';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `Over ${days}d ${hours}u`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `Over ${hours}u ${mins}m`;
}

function SummaryChips({ summary }: { summary: { present: number; absent: number; uncertain: number; noResponse: number } }) {
  return (
    <View style={styles.chipRow}>
      <View style={[styles.chip, { backgroundColor: M3.successContainer }]}>
        <MaterialCommunityIcons name="check-circle" size={14} color={M3.success} />
        <Text style={[styles.chipText, { color: M3.success }]}> {summary.present}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: M3.absentContainer }]}>
        <MaterialCommunityIcons name="close-circle" size={14} color={M3.absent} />
        <Text style={[styles.chipText, { color: M3.absent }]}> {summary.absent}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: M3.warningContainer }]}>
        <MaterialCommunityIcons name="help-circle" size={14} color={M3.warning} />
        <Text style={[styles.chipText, { color: M3.warning }]}> {summary.uncertain}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: M3.surfaceContainerHigh }]}>
        <MaterialCommunityIcons name="minus-circle-outline" size={14} color={M3.outline} />
        <Text style={[styles.chipText, { color: M3.outline }]}> {summary.noResponse}</Text>
      </View>
    </View>
  );
}

function GameCard({
  game,
  summary,
  onPress,
  isHero,
}: {
  game: Game;
  summary: { present: number; absent: number; uncertain: number; noResponse: number } | null;
  onPress: () => void;
  isHero?: boolean;
}) {
  const isPast = game.startDate < new Date();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isPast && styles.cardPast,
        isHero && styles.cardHero,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isHero && (
        <View style={styles.countdownBadge}>
          <Text style={styles.countdownText}>{formatCountdown(game.startDate)}</Text>
        </View>
      )}
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

      <Text style={[styles.opponent, isPast && styles.textMuted, isHero && styles.opponentHero]}>
        vs {game.opponent}
      </Text>

      <Text style={[styles.location, isPast && styles.textMuted]} numberOfLines={1}>
        <MaterialCommunityIcons name="map-marker" size={14} color={isPast ? M3.outline : M3.onSurfaceVariant} /> {game.location}
      </Text>

      {summary && <SummaryChips summary={summary} />}
    </TouchableOpacity>
  );
}

/** Compact cover-display mode for flip phone outer screens */
function CoverDisplayMode({
  nextGame,
  summary,
  teamName,
  onPress,
}: {
  nextGame: Game | null;
  summary: { present: number; absent: number; uncertain: number; noResponse: number } | null;
  teamName: string;
  onPress: () => void;
}) {
  if (!nextGame) {
    return (
      <View style={coverStyles.container}>
        <Text style={coverStyles.teamLabel}>{teamName}</Text>
        <Text style={coverStyles.noGame}>Geen wedstrijden</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={coverStyles.container} onPress={onPress} activeOpacity={0.9}>
      <Text style={coverStyles.teamLabel}>{teamName}</Text>
      <Text style={coverStyles.countdown}>{formatCountdown(nextGame.startDate)}</Text>
      <View style={coverStyles.gameCard}>
        <View
          style={[
            coverStyles.badge,
            nextGame.isHome ? coverStyles.badgeHome : coverStyles.badgeAway,
          ]}
        >
          <Text style={coverStyles.badgeText}>
            {nextGame.isHome ? 'THUIS' : 'UIT'}
          </Text>
        </View>
        <Text style={coverStyles.opponent}>vs {nextGame.opponent}</Text>
        <Text style={coverStyles.date}>{formatDate(nextGame.startDate)}</Text>
        <Text style={coverStyles.location} numberOfLines={1}>
          <MaterialCommunityIcons name="map-marker" size={12} color={M3.inverseOnSurface} /> {nextGame.location}
        </Text>
      </View>
      {summary && (
        <View style={coverStyles.summaryRow}>
          <View style={[coverStyles.summaryDot, { backgroundColor: M3.successContainer }]}>
            <Text style={coverStyles.summaryNum}>{summary.present}</Text>
            <MaterialCommunityIcons name="check-circle" size={16} color={M3.success} />
          </View>
          <View style={[coverStyles.summaryDot, { backgroundColor: M3.absentContainer }]}>
            <Text style={coverStyles.summaryNum}>{summary.absent}</Text>
            <MaterialCommunityIcons name="close-circle" size={16} color={M3.absent} />
          </View>
          <View style={[coverStyles.summaryDot, { backgroundColor: M3.warningContainer }]}>
            <Text style={coverStyles.summaryNum}>{summary.uncertain}</Text>
            <MaterialCommunityIcons name="help-circle" size={16} color={M3.warning} />
          </View>
        </View>
      )}
      <Text style={coverStyles.hint}>Tik om te openen →</Text>
    </TouchableOpacity>
  );
}

export default function GamesScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isCoverDisplay = height < 500 && width < 500;
  const contentWidth = Math.min(width, 600);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamConfig | null>(null);
  const [availableTeams, setAvailableTeams] = useState<TeamConfig[]>([]);
  const [summaries, setSummaries] = useState<
    Record<string, { present: number; absent: number; uncertain: number; noResponse: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentPlayer().then((player) => {
      setCurrentPlayer(player);
      if (player) {
        // Admins see all teams, teamAdmins and players see only their teams
        const teams =
          player.role === 'admin'
            ? TEAMS
            : TEAMS.filter((t) => player.team_ids?.includes(t.id));
        setAvailableTeams(teams);
        if (teams.length > 0 && !selectedTeam) {
          setSelectedTeam(teams[0]);
        }
      }
    });
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const loadGames = useCallback(async () => {
    if (!selectedTeam) return;
    try {
      setError(null);
      const [fetchedPlayers, fetchedGames] = await Promise.all([
        getPlayersForTeam(selectedTeam.id),
        fetchGames(selectedTeam.icsUrl),
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
  }, [selectedTeam]);

  useEffect(() => {
    if (selectedTeam) {
      setLoading(true);
      loadGames().finally(() => setLoading(false));
    }
  }, [selectedTeam, loadGames]);

  // Refresh summaries when navigating back from a game detail page
  useFocusEffect(
    useCallback(() => {
      if (!loading && selectedTeam) {
        loadGames();
      }
    }, [loading, selectedTeam, loadGames])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  }, [loadGames]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={M3.primary} />
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
  const nextGame = upcoming.length > 0 ? upcoming[0] : null;

  // Flip phone cover display mode
  if (isCoverDisplay) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CoverDisplayMode
          nextGame={nextGame}
          summary={nextGame ? summaries[nextGame.id] || null : null}
          teamName={selectedTeam?.shortName ?? 'Quick'}
          onPress={() => {
            if (nextGame) {
              router.push({
                pathname: '/game/[id]',
                params: { id: nextGame.id, data: JSON.stringify(nextGame), teamId: selectedTeam?.id ?? '' },
              });
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.hero}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>
            {currentPlayer?.name?.split(' ')[0] ?? ''}
          </Text>
          <MaterialCommunityIcons name="logout" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/games')}>
          <Image
            source={{ uri: QUICK_LOGO_URL }}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>{TEAM_NAME}</Text>
        <Text style={styles.heroSubtitle}>Aanmelden voor wedstrijden</Text>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={[styles.list, { maxWidth: contentWidth, alignSelf: 'center' as const, width: '100%' as unknown as number }]}
          data={[...upcoming, ...past]}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={M3.primary} />
          }
          ListHeaderComponent={
            availableTeams.length > 1 ? (
              <View style={styles.segmentedContainer}>
                <View style={styles.segmentedButton}>
                  {availableTeams.map((team, i) => (
                    <TouchableOpacity
                      key={team.id}
                      style={[
                        styles.segment,
                        selectedTeam?.id === team.id && styles.segmentActive,
                        i === 0 && styles.segmentFirst,
                        i === availableTeams.length - 1 && styles.segmentLast,
                      ]}
                      onPress={() => setSelectedTeam(team)}
                    >
                      {selectedTeam?.id === team.id && (
                        <Text style={styles.segmentCheck}>✓ </Text>
                      )}
                      <Text
                        style={[
                          styles.segmentText,
                          selectedTeam?.id === team.id && styles.segmentTextActive,
                        ]}
                      >
                        {team.shortName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
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
                isHero={index === 0 && upcoming.length > 0}
                onPress={() =>
                  router.push({
                    pathname: '/game/[id]',
                    params: { id: item.id, data: JSON.stringify(item), teamId: selectedTeam?.id ?? '' },
                  })
                }
              />
            </>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="baseball" size={48} color={M3.onSurfaceVariant} />
              <Text style={styles.emptyText}>Geen wedstrijden gevonden</Text>
            </View>
          }
          ListFooterComponent={<DisclaimerFooter />}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#1E5FA0',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroLogo: {
    width: 160,
    height: 160,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typography.titleMedium,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    ...typography.labelSmall,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  listWrapper: {
    flex: 1,
    backgroundColor: M3.surface,
  },
  list: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: M3.surface,
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 15,
    color: M3.onSurfaceVariant,
    letterSpacing: 0.25,
  },
  errorText: {
    fontSize: 15,
    color: M3.absent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: M3.primary,
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  retryText: {
    color: M3.onPrimary,
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  logoutBtn: {
    position: 'absolute',
    top: 10,
    right: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  // Material 3 segmented button
  segmentedContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  segmentedButton: {
    flexDirection: 'row',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: M3.outline,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 1,
    borderRightColor: M3.outline,
  },
  segmentFirst: {
    borderTopLeftRadius: radii.full,
    borderBottomLeftRadius: radii.full,
  },
  segmentLast: {
    borderTopRightRadius: radii.full,
    borderBottomRightRadius: radii.full,
    borderRightWidth: 0,
  },
  segmentActive: {
    backgroundColor: M3.secondaryContainer,
  },
  segmentCheck: {
    color: M3.onSecondaryContainer,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentText: {
    ...typography.labelLarge,
    color: M3.onSurface,
  },
  segmentTextActive: {
    color: M3.onSecondaryContainer,
    fontWeight: '600',
  },
  sectionHeader: {
    ...typography.labelLarge,
    color: M3.onSurfaceVariant,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  // Game cards
  card: {
    backgroundColor: M3.surfaceContainer,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs + 2,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
  },
  cardPast: {
    opacity: 0.5,
  },
  cardHero: {
    backgroundColor: M3.primaryContainer,
    borderColor: M3.primary,
    borderWidth: 1,
  },
  countdownBadge: {
    backgroundColor: M3.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  countdownText: {
    color: M3.onPrimary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeHome: {
    backgroundColor: M3.successContainer,
  },
  badgeAway: {
    backgroundColor: M3.warningContainer,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: M3.onSurface,
  },
  dateText: {
    fontSize: 13,
    color: M3.onSurfaceVariant,
  },
  textMuted: {
    color: M3.outline,
  },
  opponent: {
    ...typography.titleLarge,
    fontWeight: '600',
    color: M3.onSurface,
    marginBottom: spacing.xs,
  },
  opponentHero: {
    color: M3.onPrimaryContainer,
  },
  location: {
    fontSize: 13,
    color: M3.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  // Summary chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: M3.onSurfaceVariant,
  },
});

/** Styles for the flip phone cover display widget */
const coverStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: M3.inverseSurface,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  teamLabel: {
    color: M3.inversePrimary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  countdown: {
    color: M3.inverseOnSurface,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: spacing.md,
  },
  noGame: {
    color: M3.inverseOnSurface,
    fontSize: 16,
    opacity: 0.7,
  },
  gameCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.xl,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  badgeHome: {
    backgroundColor: M3.successContainer,
  },
  badgeAway: {
    backgroundColor: M3.warningContainer,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: M3.onSurface,
  },
  opponent: {
    color: M3.inverseOnSurface,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  date: {
    color: M3.inversePrimary,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  location: {
    color: M3.inverseOnSurface,
    fontSize: 12,
    opacity: 0.7,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  summaryDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 16,
    fontWeight: '700',
    color: M3.onSurface,
  },
  hint: {
    color: M3.inversePrimary,
    fontSize: 11,
    marginTop: spacing.md,
    opacity: 0.6,
  },
});
