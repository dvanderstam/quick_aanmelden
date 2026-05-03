import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  useWindowDimensions,
  Image,
  Alert,
  Pressable,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AttendanceStatus, Game, Player } from '../../src/types';
import {
  getAllAttendanceForGame,
  setAttendance,
  setNeedsReplacement,
  markSubstitute,
} from '../../src/storage';
import { getCurrentPlayer, canEditPlayer, canManageTeam, getPlayersForTeam, signOut } from '../../src/auth';
import { M3, radii, spacing, typography } from '../../src/theme';
import { QUICK_LOGO_URL, TEAM_NAME, teamHasReplacementFlow } from '../../src/config';
import { DisclaimerFooter } from '../../src/DisclaimerFooter';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: string; bg: string; active: string }[] = [
  { value: 'present', label: 'Aanwezig', icon: 'check-circle', bg: M3.successContainer, active: M3.success },
  { value: 'absent', label: 'Afwezig', icon: 'close-circle', bg: M3.absentContainer, active: M3.absent },
  { value: 'uncertain', label: 'Onzeker', icon: 'help-circle', bg: M3.warningContainer, active: M3.warning },
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
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; data: string; teamId: string }>();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 600);
  const game: Game | null = params.data
    ? (() => {
        try {
          const parsed = JSON.parse(params.data);
          return {
            ...parsed,
            startDate: new Date(parsed.startDate),
            endDate: new Date(parsed.endDate),
          };
        } catch {
          return null;
        }
      })()
    : null;

  const gameId = params.id;
  const teamId = params.teamId || 'ms1';
  const replacementFlowEnabled = teamHasReplacementFlow(teamId);
  const [attendance, setAttendanceState] = useState<Record<number, AttendanceStatus>>({});
  const [timestamps, setTimestamps] = useState<Record<number, string | null>>({});
  const [needsReplacement, setNeedsReplacementState] = useState<Record<number, boolean>>({});
  const [substitutes, setSubstitutes] = useState<Record<number, boolean>>({});
  const [popoverPlayerId, setPopoverPlayerId] = useState<number | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const loadData = useCallback(async () => {
    if (!gameId) return;
    const fetchedPlayers = await getPlayersForTeam(teamId);
    setPlayers(fetchedPlayers);
    const playerIds = fetchedPlayers.map((p) => p.id);
    const result = await getAllAttendanceForGame(gameId, playerIds);
    setAttendanceState(result.statuses);
    setTimestamps(result.timestamps);
    setNeedsReplacementState(result.replacements);
    setSubstitutes(result.substitutes);
  }, [gameId, teamId]);

  useEffect(() => {
    loadData();
    getCurrentPlayer().then(setCurrentPlayer);
  }, [loadData]);

  const checkAbsenceWarning = (newAttendance: Record<number, AttendanceStatus>) => {
    if (!replacementFlowEnabled) return;
    const absentTotal = Object.values(newAttendance).filter((s) => s === 'absent').length;
    if (absentTotal >= 3) {
      const msg = `Je bent de ${absentTotal}e afmelder. Graag een vervanger zoeken. Meld wie het is in de app en aan Bas.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Let op!', msg, [{ text: 'Begrepen' }]);
      }
    }
  };

  const handleToggle = async (playerId: number) => {
    const current = attendance[playerId] || null;
    const order: AttendanceStatus[] = [null, 'present', 'absent', 'uncertain'];
    const nextIndex = (order.indexOf(current) + 1) % order.length;
    const next = order[nextIndex];

    const updated = { ...attendance, [playerId]: next };
    const absentCount = Object.values(updated).filter((s) => s === 'absent').length;
    const shouldFlag = next === 'absent' && absentCount >= 3 && replacementFlowEnabled;
    const clearFlag = next !== 'absent';

    // Als speler zichzelf weer op aanwezig zet, verwijder substitute label
    if (next === 'present' && substitutes[playerId]) {
      // markSubstitute accepteert geen 3e argument, clearing gebeurt via setAttendance
      setSubstitutes((prev) => ({ ...prev, [playerId]: false }));
    }

    await setAttendance(gameId, playerId, next, shouldFlag ? true : clearFlag ? false : undefined);
    const now = new Date().toISOString();
    setAttendanceState(updated);
    setTimestamps((prev) => ({ ...prev, [playerId]: next === null ? null : now }));
    if (shouldFlag) setNeedsReplacementState((prev) => ({ ...prev, [playerId]: true }));
    if (clearFlag) setNeedsReplacementState((prev) => ({ ...prev, [playerId]: false }));
    if (next === 'absent') checkAbsenceWarning(updated);
  };

  const handleSetStatus = async (playerId: number, status: AttendanceStatus) => {
    const current = attendance[playerId];
    const newStatus = current === status ? null : status;

    const updated = { ...attendance, [playerId]: newStatus };
    const absentCount = Object.values(updated).filter((s) => s === 'absent').length;
    const shouldFlag = newStatus === 'absent' && absentCount >= 3 && replacementFlowEnabled;
    const clearFlag = newStatus !== 'absent';

    // Als speler zichzelf weer op aanwezig zet, verwijder substitute label
    if (newStatus === 'present' && substitutes[playerId]) {
      setSubstitutes((prev) => ({ ...prev, [playerId]: false }));
    }

    await setAttendance(gameId, playerId, newStatus, shouldFlag ? true : clearFlag ? false : undefined);
    const now = new Date().toISOString();
    setAttendanceState(updated);
    setTimestamps((prev) => ({ ...prev, [playerId]: newStatus === null ? null : now }));
    if (shouldFlag) setNeedsReplacementState((prev) => ({ ...prev, [playerId]: true }));
    if (clearFlag) setNeedsReplacementState((prev) => ({ ...prev, [playerId]: false }));
    if (newStatus === 'absent') checkAbsenceWarning(updated);
  };

  const handleDismissReplacement = async (playerId: number) => {
    if (!currentPlayer) return;
    if (!canManageTeam(currentPlayer, teamId)) {
      setPopoverPlayerId(null);
      return;
    }
    await markSubstitute(gameId, playerId);
    setAttendanceState((prev) => ({ ...prev, [playerId]: 'present' }));
    setNeedsReplacementState((prev) => ({ ...prev, [playerId]: false }));
    setSubstitutes((prev) => ({ ...prev, [playerId]: true }));
    setTimestamps((prev) => ({ ...prev, [playerId]: new Date().toISOString() }));
    setPopoverPlayerId(null);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const closeSheet = useCallback(() => {
    setPopoverPlayerId(null);
    sheetTranslateY.setValue(0);
  }, [sheetTranslateY]);

  const sheetPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!(width < 520) || popoverPlayerId === null) return false;
        return gestureState.dy > 8 && Math.abs(gestureState.dx) < 24;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 1.2) {
          closeSheet();
          return;
        }
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 12,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 12,
        }).start();
      },
    }),
    [closeSheet, popoverPlayerId, sheetTranslateY, width]
  );

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
  const isPastGame = game.endDate < new Date();
  const isSmallScreen = width < 520;
  const popoverPlayer = players.find((p) => p.id === popoverPlayerId) ?? null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.hero}>
        <TouchableOpacity onPress={() => router.replace('/games')} style={styles.homeBtn}>
          <MaterialCommunityIcons name="home" size={24} color="#FFFFFF" />
        </TouchableOpacity>
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
        <Text style={styles.heroSubtitle}>{isPastGame ? 'Wedstrijdhistorie' : 'Aanmelden voor wedstrijden'}</Text>
      </View>
      <View style={styles.wrapper}>
        <FlatList
          style={[styles.container, { maxWidth: contentWidth, alignSelf: 'center' as const, width: '100%' as unknown as number }]}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={[styles.matchInfo, isPastGame && styles.matchInfoPast]}>
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

                {isPastGame && (
                  <View style={styles.historyBadge}>
                    <MaterialCommunityIcons name="history" size={14} color={M3.onSecondaryContainer} />
                    <Text style={styles.historyBadgeText}>Gespeelde wedstrijd</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.locationButton, isPastGame && styles.locationButtonPast]}
                  onPress={() => openMaps(game.location)}
                >
                  <Text style={styles.locationText}><MaterialCommunityIcons name="map-marker" size={14} color={M3.onPrimaryContainer} /> {game.location}</Text>
                  <Text style={styles.locationHint}>{isPastGame ? 'Locatie bekijken →' : 'Tik om te navigeren →'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.summaryBar}>
                <View style={[styles.summaryItem, { backgroundColor: M3.successContainer }]}>
                  <Text style={[styles.summaryNumber, { color: M3.success }]}>{presentCount}</Text>
                  <Text style={styles.summaryLabel}>Aanwezig</Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: M3.absentContainer }]}>
                  <Text style={[styles.summaryNumber, { color: M3.absent }]}>{absentCount}</Text>
                  <Text style={styles.summaryLabel}>Afwezig</Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: M3.warningContainer }]}>
                  <Text style={[styles.summaryNumber, { color: M3.warning }]}>{uncertainCount}</Text>
                  <Text style={styles.summaryLabel}>Onzeker</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{isPastGame ? 'Registraties' : 'Spelers'}</Text>
            </View>
          }
          data={players}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item: player }) => {
            const status = attendance[player.id] || null;
            const editable = currentPlayer ? canEditPlayer(currentPlayer, player.id, teamId) : false;
            return (
              <View style={[styles.playerRow, !editable && styles.playerRowDisabled]}>
                <View style={styles.playerInfo}>
                  <View style={styles.avatarWrapper}>
                    <View style={[
                      styles.avatarBadge,
                      status === 'present' && { backgroundColor: M3.success },
                      status === 'absent' && { backgroundColor: M3.absent },
                      status === 'uncertain' && { backgroundColor: M3.warning },
                    ]}>
                      <Text style={styles.avatarText}>
                        {player.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    {needsReplacement[player.id] && (
                      <TouchableOpacity
                        style={styles.replacementBadge}
                        onPress={() => setPopoverPlayerId(popoverPlayerId === player.id ? null : player.id)}
                      >
                        <MaterialCommunityIcons name="alert" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View>
                    <Text style={styles.playerName}>
                      {player.name}
                      {substitutes[player.id] && (
                        <Text style={styles.substituteLabel}> (vervangende speler)</Text>
                      )}
                    </Text>
                    {status && (
                      <Text style={[
                        styles.playerStatus,
                        status === 'present' && { color: M3.success },
                        status === 'absent' && { color: M3.absent },
                        status === 'uncertain' && { color: M3.warning },
                      ]}>
                        {STATUS_OPTIONS.find(o => o.value === status)?.label}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.statusButtons}>
                  {STATUS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      disabled={!editable}
                      style={[
                        styles.statusBtn,
                        status === opt.value && { backgroundColor: opt.bg, borderColor: opt.active },
                        !editable && styles.statusBtnDisabled,
                      ]}
                      onPress={() => handleSetStatus(player.id, opt.value)}
                    >
                      <MaterialCommunityIcons
                        name={opt.icon as any}
                        size={20}
                        color={status === opt.value ? opt.active : M3.onSurfaceVariant}
                        style={[!editable && styles.statusEmojiDisabled]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {timestamps[player.id] && (
                  <Text style={styles.timestampText}>
                    {(() => {
                      const d = new Date(timestamps[player.id]!);
                      const day = d.getDate().toString().padStart(2, '0');
                      const month = (d.getMonth() + 1).toString().padStart(2, '0');
                      const hours = d.getHours().toString().padStart(2, '0');
                      const minutes = d.getMinutes().toString().padStart(2, '0');
                      return `${day}-${month} ${hours}:${minutes}`;
                    })()}
                  </Text>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={<DisclaimerFooter />}
        />
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={popoverPlayerId !== null}
        onRequestClose={closeSheet}
      >
        <View style={[styles.modalBackdrop, isSmallScreen && styles.modalBackdropBottom]}>
          <Pressable style={styles.modalBackdropTapZone} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.modalCard,
              isSmallScreen && styles.modalCardBottomSheet,
              isSmallScreen && { transform: [{ translateY: sheetTranslateY }] },
            ]}
            {...(isSmallScreen ? sheetPanResponder.panHandlers : {})}
          >
            {isSmallScreen && <View style={styles.sheetHandle} />}
            <Text style={styles.popoverText}>Vervanger regelen</Text>
            {popoverPlayer?.name && (
              <Text style={styles.modalPlayerName}>{popoverPlayer.name}</Text>
            )}
            {currentPlayer && canManageTeam(currentPlayer, teamId) ? (
              <TouchableOpacity
                style={styles.popoverBtn}
                onPress={() => {
                  if (popoverPlayerId !== null) handleDismissReplacement(popoverPlayerId);
                }}
              >
                <Text style={styles.popoverBtnText}>Geregeld ✓</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.modalHint}>Alleen captain/teamadmin/admin kan dit afronden.</Text>
            )}
          </Animated.View>
        </View>
      </Modal>
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
  homeBtn: {
    position: 'absolute',
    top: 10,
    left: spacing.md,
    zIndex: 1,
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
    zIndex: 1,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  wrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: M3.surface,
  },
  header: {
    paddingBottom: spacing.sm,
  },
  matchInfo: {
    backgroundColor: M3.primaryContainer,
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  matchInfoPast: {
    backgroundColor: M3.surfaceContainerHigh,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginBottom: spacing.md,
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
    letterSpacing: 1,
    color: M3.onSurface,
  },
  opponentText: {
    ...typography.headlineMedium,
    fontWeight: '700',
    color: M3.onPrimaryContainer,
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: 15,
    color: M3.onPrimaryContainer,
    opacity: 0.7,
    marginBottom: spacing.md,
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: M3.secondaryContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginBottom: spacing.md,
  },
  historyBadgeText: {
    color: M3.onSecondaryContainer,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  locationButton: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    width: '100%',
  },
  locationButtonPast: {
    backgroundColor: M3.surfaceContainer,
  },
  locationText: {
    color: M3.onPrimaryContainer,
    fontSize: 14,
    fontWeight: '500',
  },
  locationHint: {
    color: M3.primary,
    fontSize: 12,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  summaryBar: {
    flexDirection: 'row',
    margin: spacing.md,
    gap: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  summaryLabel: {
    ...typography.labelSmall,
    color: M3.onSurfaceVariant,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: M3.onSurfaceVariant,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: M3.surfaceContainer,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M3.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  replacementBadge: {
    position: 'absolute',
    top: -4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: M3.absent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: M3.surfaceContainer,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalBackdropTapZone: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdropBottom: {
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: M3.onSurface,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 14px rgba(0,0,0,0.35)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 14,
      },
    }),
  },
  modalCardBottomSheet: {
    maxWidth: '100%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginBottom: spacing.md,
  },
  popoverText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalPlayerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  popoverBtn: {
    marginTop: spacing.md,
    backgroundColor: M3.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  popoverBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalHint: {
    marginTop: spacing.md,
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.85,
    textAlign: 'center',
  },
  avatarText: {
    color: M3.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  playerName: {
    ...typography.bodyLarge,
    fontWeight: '500',
    color: M3.onSurface,
  },
  substituteLabel: {
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'italic',
    color: M3.onSurfaceVariant,
  },
  playerStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: M3.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playerRowDisabled: {
    opacity: 0.5,
  },
  statusBtnDisabled: {
    opacity: 0.4,
  },
  statusEmojiDisabled: {
    opacity: 0.4,
  },
  timestampText: {
    fontSize: 11,
    color: M3.onSurfaceVariant,
    marginTop: 6,
    textAlign: 'right',
  },
  separator: {
    height: spacing.sm,
  },
});
