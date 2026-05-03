import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
  Share,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Player } from '../src/types';
import { getAllPlayers, getCurrentPlayer } from '../src/auth';
import {
  bulkImportTeamPlayers,
  BulkImportResponse,
  createTeam,
  createOrLinkPlayer,
  getTeams,
  removePlayerFromTeam,
  resetPlayerPasswordToDefault,
  setPlayerActive,
  setPlayerTeams,
  suggestUsername,
  updateTeam,
  updatePlayerProfile,
} from '../src/teamAdmin';
import { DEFAULT_PASSWORD, TeamConfig, getTeamConfig } from '../src/config';
import { M3, radii, spacing, typography } from '../src/theme';

const LOGIN_URL = 'https://quickams.netlify.app/login';
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const TEAM_ID_REGEX = /^[a-z0-9-]{2,20}$/;

function normalizeFilterValue(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function TooltipIconButton({
  tooltip,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  children,
}: {
  tooltip: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  accessibilityLabel: string;
  children: any;
}) {
  const [hovered, setHovered] = useState(false);
  const showTooltip = Platform.OS === 'web' && hovered;

  return (
    <View style={styles.tooltipAnchor}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </Pressable>
      {showTooltip && (
        <View pointerEvents="none" style={styles.tooltipBubble}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      )}
    </View>
  );
}

function TooltipHover({
  tooltip,
  children,
}: {
  tooltip: string;
  children: any;
}) {
  const [hovered, setHovered] = useState(false);
  const showTooltip = Platform.OS === 'web' && hovered;

  return (
    <View style={styles.tooltipAnchor}>
      <Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
        {children}
      </Pressable>
      {showTooltip && (
        <View pointerEvents="none" style={styles.tooltipBubble}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [teamModalVisible, setTeamModalVisible] = useState(false);
  const [teamModalPlayer, setTeamModalPlayer] = useState<Player | null>(null);
  const [draftTeamIds, setDraftTeamIds] = useState<string[]>([]);
  const [draftCaptainTeamIds, setDraftCaptainTeamIds] = useState<string[]>([]);
  const [draftNonCountedTeamIds, setDraftNonCountedTeamIds] = useState<string[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);
  const [editPlayerVisible, setEditPlayerVisible] = useState(false);
  const [editPlayerTarget, setEditPlayerTarget] = useState<Player | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerUsername, setEditPlayerUsername] = useState('');
  const [editPlayerError, setEditPlayerError] = useState<string | null>(null);
  const [savingPlayerProfile, setSavingPlayerProfile] = useState(false);
  const [addPlayerVisible, setAddPlayerVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addPlayerTeamId, setAddPlayerTeamId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingPlayer, setSubmittingPlayer] = useState(false);
  const [addTeamVisible, setAddTeamVisible] = useState(false);
  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShortName, setNewTeamShortName] = useState('');
  const [newTeamIcsUrl, setNewTeamIcsUrl] = useState('');
  const [newTeamReplacementFlow, setNewTeamReplacementFlow] = useState(false);
  const [newTeamActive, setNewTeamActive] = useState(true);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);
  const [editTeamVisible, setEditTeamVisible] = useState(false);
  const [editTeamId, setEditTeamId] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamShortName, setEditTeamShortName] = useState('');
  const [editTeamIcsUrl, setEditTeamIcsUrl] = useState('');
  const [editTeamReplacementFlow, setEditTeamReplacementFlow] = useState(false);
  const [editTeamActive, setEditTeamActive] = useState(true);
  const [savingEditTeam, setSavingEditTeam] = useState(false);
  const [editTeamError, setEditTeamError] = useState<string | null>(null);
  const [bulkImportVisible, setBulkImportVisible] = useState(false);
  const [bulkImportTeamId, setBulkImportTeamId] = useState('');
  const [bulkImportNamesText, setBulkImportNamesText] = useState('');
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportSubmitting, setBulkImportSubmitting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResponse | null>(null);
  const infoMsgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = currentPlayer?.role === 'admin';
  const captainManagedTeamIds = useMemo(() => currentPlayer?.captain_team_ids || [], [currentPlayer]);
  const captainManagedTeamIdSet = useMemo(() => new Set(captainManagedTeamIds), [captainManagedTeamIds]);
  const canAssignCaptains = captainManagedTeamIds.length > 0;

  const manageableTeamIds = useMemo(() => {
    if (!currentPlayer) return [];
    if (currentPlayer.role === 'admin') return teams.map((t) => t.id);

    const fromTeamAdmin = currentPlayer.role === 'teamAdmin' ? (currentPlayer.team_ids || []) : [];
    const fromCaptain = currentPlayer.captain_team_ids || [];
    return [...new Set([...fromTeamAdmin, ...fromCaptain])];
  }, [currentPlayer, teams]);

  const manageableTeamIdSet = useMemo(() => new Set(manageableTeamIds), [manageableTeamIds]);

  const allowedAddTeams = useMemo(
    () => teams.filter((team) => manageableTeamIdSet.has(team.id) && team.active !== false),
    [manageableTeamIdSet, teams]
  );

  const adminCreatableTeams = useMemo(
    () => teams.filter((team) => team.active !== false),
    [teams]
  );

  const adminEditableTeams = useMemo(
    () => teams,
    [teams]
  );

  const bulkImportTeams = useMemo(
    () => (isAdmin ? adminCreatableTeams : allowedAddTeams),
    [adminCreatableTeams, allowedAddTeams, isAdmin]
  );

  const loadTeams = useCallback(async () => {
    try {
      const fetched = await getTeams(true);
      setTeams(fetched);
    } catch {
      setErrorMsg('Kon teams niet laden.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAccessContext = async () => {
      const p = await getCurrentPlayer();
      if (cancelled) return;

      const canAccess = !!p && (
        p.role === 'admin'
        || p.role === 'teamAdmin'
        || (p.captain_team_ids || []).length > 0
      );

      if (!canAccess) {
        router.replace('/games');
        return;
      }

      setCurrentPlayer(p);
      await loadTeams();
    };

    loadAccessContext();

    return () => {
      cancelled = true;
    };
  }, [loadTeams, router]);

  useEffect(() => {
    return () => {
      if (infoMsgTimeoutRef.current) {
        clearTimeout(infoMsgTimeoutRef.current);
        infoMsgTimeoutRef.current = null;
      }
    };
  }, []);

  const showInfoMessage = useCallback((message: string) => {
    setInfoMsg(message);
    if (infoMsgTimeoutRef.current) {
      clearTimeout(infoMsgTimeoutRef.current);
    }

    infoMsgTimeoutRef.current = setTimeout(() => {
      setInfoMsg(null);
      infoMsgTimeoutRef.current = null;
    }, 3000);
  }, []);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getAllPlayers();
      setPlayers(data);
    } catch {
      setErrorMsg('Kon spelers niet laden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    if (allowedAddTeams.length === 0) {
      setAddPlayerTeamId('');
      return;
    }

    if (!allowedAddTeams.some((team) => team.id === addPlayerTeamId)) {
      setAddPlayerTeamId(allowedAddTeams[0].id);
    }
  }, [addPlayerTeamId, allowedAddTeams]);

  useEffect(() => {
    if (bulkImportTeams.length === 0) {
      setBulkImportTeamId('');
      return;
    }

    if (!bulkImportTeams.some((team) => team.id === bulkImportTeamId)) {
      setBulkImportTeamId(bulkImportTeams[0].id);
    }
  }, [bulkImportTeamId, bulkImportTeams]);

  const handleToggleActive = useCallback(async (player: Player) => {
    const next = !player.active;
    setTogglingId(player.id);
    setErrorMsg(null);
    try {
      await setPlayerActive(player.id, next);
      setPlayers((prev) => prev.map((p) => p.id === player.id ? { ...p, active: next } : p));
    } catch (err: any) {
      setErrorMsg(err.message || 'Status bijwerken mislukt.');
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleResetPassword = useCallback((player: Player) => {
    const doReset = async () => {
      setResettingId(player.id);
      setErrorMsg(null);
      try {
        await resetPlayerPasswordToDefault(player.id);
        const msg = `Wachtwoord van ${player.name} is teruggezet naar het standaard wachtwoord. De speler moet bij de volgende login een nieuw wachtwoord instellen.`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Wachtwoord teruggezet', msg, [{ text: 'OK' }]);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Wachtwoord resetten mislukt.');
      } finally {
        setResettingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Wachtwoord van ${player.name} terugzetten naar standaard?`)) {
        doReset();
      }
    } else {
      Alert.alert(
        'Wachtwoord terugzetten',
        `Wil je het wachtwoord van ${player.name} terugzetten naar het standaard wachtwoord?`,
        [
          { text: 'Annuleren', style: 'cancel' },
          { text: 'Terugzetten', style: 'destructive', onPress: doReset },
        ]
      );
    }
  }, []);

  const openTeamModal = useCallback((player: Player) => {
    if (!isAdmin) {
      if (!currentPlayer || !canAssignCaptains) return;
      if (player.id === currentPlayer.id) {
        setErrorMsg('Je kunt je eigen captainrechten niet wijzigen.');
        return;
      }
      const sharesCaptainTeam = (player.team_ids || []).some((teamId) => captainManagedTeamIdSet.has(teamId));
      if (!sharesCaptainTeam) {
        setErrorMsg('Je mag alleen captainrechten aanpassen binnen je eigen team(s).');
        return;
      }
    }

    setTeamModalPlayer(player);
    setDraftTeamIds(player.team_ids || []);
    setDraftCaptainTeamIds(player.captain_team_ids || []);
    setDraftNonCountedTeamIds(player.not_counted_team_ids || []);
    setErrorMsg(null);
    setTeamModalVisible(true);
  }, [canAssignCaptains, captainManagedTeamIdSet, currentPlayer, isAdmin]);

  const modalTeams = useMemo(() => {
    if (!teamModalPlayer) return [];
    if (isAdmin) return teams;

    const playerTeamIdSet = new Set(teamModalPlayer.team_ids || []);
    return teams.filter((team) => captainManagedTeamIdSet.has(team.id) && playerTeamIdSet.has(team.id));
  }, [captainManagedTeamIdSet, isAdmin, teamModalPlayer, teams]);

  const toggleDraftTeam = useCallback((teamId: string) => {
    if (!isAdmin && !captainManagedTeamIdSet.has(teamId)) return;
    setDraftTeamIds((prev) => {
      if (prev.includes(teamId)) {
        setDraftCaptainTeamIds((captains) => captains.filter((id) => id !== teamId));
        setDraftNonCountedTeamIds((excluded) => excluded.filter((id) => id !== teamId));
        return prev.filter((id) => id !== teamId);
      }
      return [...prev, teamId];
    });
  }, [captainManagedTeamIdSet, isAdmin]);

  const toggleDraftCaptainTeam = useCallback((teamId: string) => {
    if (!draftTeamIds.includes(teamId)) return;
    if (!isAdmin && !captainManagedTeamIdSet.has(teamId)) return;
    setDraftCaptainTeamIds((prev) => {
      if (prev.includes(teamId)) return prev.filter((id) => id !== teamId);
      return [...prev, teamId];
    });
  }, [captainManagedTeamIdSet, draftTeamIds, isAdmin]);

  const toggleDraftNonCountedTeam = useCallback((teamId: string) => {
    if (!draftTeamIds.includes(teamId)) return;
    if (!isAdmin) return;
    setDraftNonCountedTeamIds((prev) => {
      if (prev.includes(teamId)) return prev.filter((id) => id !== teamId);
      return [...prev, teamId];
    });
  }, [draftTeamIds, isAdmin]);

  const confirmTeamRemovals = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) return true;

    const teamNames = teamIds
      .map((teamId) => getTeamConfig(teamId)?.shortName || teamId)
      .join(', ');
    const message = `Je gaat deze speler verwijderen uit: ${teamNames}. Weet je het zeker?`;

    if (Platform.OS === 'web') {
      return window.confirm(message);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Verwijderen uit team',
        message,
        [
          { text: 'Annuleren', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Doorgaan', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  }, []);

  const saveTeams = useCallback(async () => {
    if (!teamModalPlayer) return;
    if (!isAdmin && currentPlayer && teamModalPlayer.id === currentPlayer.id) {
      setErrorMsg('Je kunt je eigen captainrechten niet wijzigen.');
      return;
    }

    const originalTeamIds = teamModalPlayer.team_ids || [];
    const removedManagedTeamIds = isAdmin
      ? []
      : originalTeamIds.filter((teamId) => captainManagedTeamIdSet.has(teamId) && !draftTeamIds.includes(teamId));
    const teamIdsForSave = isAdmin
      ? draftTeamIds
      : originalTeamIds.filter((teamId) => !removedManagedTeamIds.includes(teamId));
    const removedTeamIds = originalTeamIds.filter((teamId) => !teamIdsForSave.includes(teamId));
    const captainTeamIdsForSave = draftCaptainTeamIds.filter((teamId) => teamIdsForSave.includes(teamId));
    const nonCountedTeamIdsForSave = draftNonCountedTeamIds.filter((teamId) => teamIdsForSave.includes(teamId));

    const confirmed = await confirmTeamRemovals(removedTeamIds);
    if (!confirmed) return;

    setSavingTeams(true);
    setErrorMsg(null);
    try {
      if (removedTeamIds.length > 0) {
        await Promise.all(removedTeamIds.map((teamId) => removePlayerFromTeam(teamModalPlayer.id, teamId)));
      }

      const membership = await setPlayerTeams(
        teamModalPlayer.id,
        teamIdsForSave,
        captainTeamIdsForSave,
        nonCountedTeamIdsForSave
      );
      setPlayers((prev) => prev.map((p) => (
        p.id === teamModalPlayer.id
          ? {
              ...p,
              team_ids: membership.teamIds,
              captain_team_ids: membership.captainTeamIds,
              not_counted_team_ids: membership.nonCountedTeamIds,
            }
          : p
      )));
      setTeamModalVisible(false);
      setTeamModalPlayer(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Teams opslaan mislukt.');
    } finally {
      setSavingTeams(false);
    }
  }, [captainManagedTeamIdSet, confirmTeamRemovals, currentPlayer, draftCaptainTeamIds, draftNonCountedTeamIds, draftTeamIds, isAdmin, teamModalPlayer]);

  const closeEditPlayerModal = useCallback(() => {
    setEditPlayerVisible(false);
    setEditPlayerTarget(null);
    setEditPlayerName('');
    setEditPlayerUsername('');
    setEditPlayerError(null);
    setSavingPlayerProfile(false);
  }, []);

  const canEditPlayerIdentity = useCallback((player: Player) => {
    if (isAdmin) return true;
    return (player.team_ids || []).some((teamId) => manageableTeamIdSet.has(teamId));
  }, [isAdmin, manageableTeamIdSet]);

  const openEditPlayerModal = useCallback((player: Player) => {
    if (!canEditPlayerIdentity(player)) {
      setErrorMsg('Je mag alleen spelers uit je eigen team(s) bewerken.');
      return;
    }

    setEditPlayerTarget(player);
    setEditPlayerName(player.name || '');
    setEditPlayerUsername((player.username || '').toLowerCase());
    setEditPlayerError(null);
    setEditPlayerVisible(true);
  }, [canEditPlayerIdentity]);

  const savePlayerProfile = useCallback(async () => {
    if (!editPlayerTarget) return;

    const normalizedName = editPlayerName.trim().replace(/\s+/g, ' ');
    const normalizedUsername = editPlayerUsername.trim().toLowerCase();

    if (!normalizedName) {
      setEditPlayerError('Naam is verplicht.');
      return;
    }

    if (!normalizedUsername) {
      setEditPlayerError('Gebruikersnaam is verplicht.');
      return;
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setEditPlayerError('Gebruikersnaam mag alleen kleine letters, cijfers, punt, streepje en underscore bevatten.');
      return;
    }

    if (!canEditPlayerIdentity(editPlayerTarget)) {
      setEditPlayerError('Je mag alleen spelers uit je eigen team(s) bewerken.');
      return;
    }

    setSavingPlayerProfile(true);
    setEditPlayerError(null);

    try {
      const updated = await updatePlayerProfile(editPlayerTarget.id, normalizedName, normalizedUsername);

      setPlayers((prev) => prev.map((p) => (
        p.id === updated.id
          ? { ...p, name: updated.name, username: updated.username }
          : p
      )));

      setCurrentPlayer((prev) => (
        prev && prev.id === updated.id
          ? { ...prev, name: updated.name, username: updated.username }
          : prev
      ));

      closeEditPlayerModal();
    } catch (err: any) {
      setEditPlayerError(err.message || 'Spelergegevens opslaan mislukt.');
    } finally {
      setSavingPlayerProfile(false);
    }
  }, [canEditPlayerIdentity, closeEditPlayerModal, editPlayerName, editPlayerTarget, editPlayerUsername]);

  const suggestedUsername = useMemo(() => suggestUsername(newPlayerName), [newPlayerName]);

  const closeAddPlayerModal = useCallback(() => {
    setAddPlayerVisible(false);
    setNewPlayerName('');
    setSubmitError(null);
    setSubmittingPlayer(false);
  }, []);

  const closeAddTeamModal = useCallback(() => {
    setAddTeamVisible(false);
    setNewTeamId('');
    setNewTeamName('');
    setNewTeamShortName('');
    setNewTeamIcsUrl('');
    setNewTeamReplacementFlow(false);
    setNewTeamActive(true);
    setCreateTeamError(null);
    setCreatingTeam(false);
  }, []);

  const applyEditTeamForm = useCallback((team: TeamConfig | null) => {
    if (!team) {
      setEditTeamId('');
      setEditTeamName('');
      setEditTeamShortName('');
      setEditTeamIcsUrl('');
      setEditTeamReplacementFlow(false);
      setEditTeamActive(true);
      return;
    }

    setEditTeamId(team.id);
    setEditTeamName(team.name || '');
    setEditTeamShortName(team.shortName || '');
    setEditTeamIcsUrl(team.icsUrl || '');
    setEditTeamReplacementFlow(team.enableReplacementFlow === true);
    setEditTeamActive(team.active !== false);
  }, []);

  const openEditTeamModal = useCallback(() => {
    if (!isAdmin) {
      setErrorMsg('Alleen admins mogen teams bewerken.');
      return;
    }

    const initial = adminEditableTeams.find((team) => team.id === editTeamId)
      || adminEditableTeams[0]
      || null;

    applyEditTeamForm(initial);
    setEditTeamError(null);
    setEditTeamVisible(true);
  }, [adminEditableTeams, applyEditTeamForm, editTeamId, isAdmin]);

  const closeEditTeamModal = useCallback(() => {
    setEditTeamVisible(false);
    setSavingEditTeam(false);
    setEditTeamError(null);
  }, []);

  const closeBulkImportModal = useCallback(() => {
    setBulkImportVisible(false);
    setBulkImportNamesText('');
    setBulkImportError(null);
    setBulkImportSubmitting(false);
    setBulkImportResult(null);
  }, []);

  const isShareCancelError = useCallback((err: any) => {
    const name = String(err?.name || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return (
      name === 'aborterror'
      || message.includes('abort')
      || message.includes('cancel')
      || message.includes('dismiss')
    );
  }, []);

  const copyTextForWeb = useCallback(async (text: string): Promise<boolean> => {
    const webNavigator = typeof navigator !== 'undefined' ? navigator : null;

    try {
      if (webNavigator?.clipboard?.writeText) {
        await webNavigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Continue to legacy fallback.
    }

    if (typeof document === 'undefined') return false;

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', 'true');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      textArea.style.top = '-1000px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch {
      return false;
    }
  }, []);

  const shareNewPlayerCredentials = useCallback(async (playerName: string, username: string) => {
    const defaultPasswordText = DEFAULT_PASSWORD || '(niet ingesteld)';
    const message = [
      `Hoi ${playerName},`,
      'Hierbij je inloggegevens voor Quick AMS:',
      `URL: ${LOGIN_URL}`,
      `Gebruikersnaam: ${username}`,
      `Standaard wachtwoord: ${defaultPasswordText}`,
      'Gebruik het standaard wachtwoord alleen bij de eerste keer inloggen en kies daarna direct een nieuw wachtwoord.',
    ].join('\n');

    try {
      if (Platform.OS === 'web') {
        const webNavigator = typeof navigator !== 'undefined' ? navigator : null;
        if (webNavigator && typeof webNavigator.share === 'function') {
          try {
            await webNavigator.share({
              title: 'Inloggegevens Quick AMS',
              text: message,
            });
            showInfoMessage('Inloggegevens gedeeld.');
            return;
          } catch (shareErr: any) {
            if (isShareCancelError(shareErr)) return;
          }
        }

        const copied = await copyTextForWeb(message);
        if (copied) {
          showInfoMessage('Inloggegevens zijn gekopieerd naar je klembord.');
          return;
        }

        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Kopieer deze inloggegevens:', message);
          return;
        }

        window.alert(message);
        return;
      }

      const result = await Share.share({
        title: 'Inloggegevens Quick AMS',
        message,
      });
      if (result?.action === Share.dismissedAction) return;
      showInfoMessage('Inloggegevens gedeeld.');
    } catch (err: any) {
      if (isShareCancelError(err)) return;
      setErrorMsg('Delen van inloggegevens mislukt.');
    }
  }, [copyTextForWeb, isShareCancelError, showInfoMessage]);

  const handleCreateTeam = useCallback(async () => {
    if (!isAdmin) {
      setCreateTeamError('Alleen admins mogen teams aanmaken.');
      return;
    }

    const normalizedTeamId = newTeamId.trim().toLowerCase();
    const normalizedName = newTeamName.trim().replace(/\s+/g, ' ');
    const normalizedShortName = newTeamShortName.trim().replace(/\s+/g, ' ');
    const normalizedIcsUrl = newTeamIcsUrl.trim();

    if (!normalizedTeamId || !normalizedName || !normalizedShortName) {
      setCreateTeamError('Vul team-id, naam en short name in.');
      return;
    }

    if (!TEAM_ID_REGEX.test(normalizedTeamId)) {
      setCreateTeamError('Team-id moet 2-20 tekens zijn: a-z, 0-9 en streepje.');
      return;
    }

    if (normalizedIcsUrl && !/^https?:\/\//i.test(normalizedIcsUrl)) {
      setCreateTeamError('ICS URL moet met http:// of https:// beginnen.');
      return;
    }

    setCreatingTeam(true);
    setCreateTeamError(null);

    try {
      const created = await createTeam({
        teamId: normalizedTeamId,
        name: normalizedName,
        shortName: normalizedShortName,
        icsUrl: normalizedIcsUrl,
        enableReplacementFlow: newTeamReplacementFlow,
        active: newTeamActive,
      });

      await loadTeams();
      setAddPlayerTeamId(created.team.id);
      closeAddTeamModal();
      showInfoMessage(`Team ${created.team.shortName} is aangemaakt.`);
    } catch (err: any) {
      setCreateTeamError(err.message || 'Team aanmaken mislukt.');
    } finally {
      setCreatingTeam(false);
    }
  }, [
    closeAddTeamModal,
    isAdmin,
    loadTeams,
    newTeamActive,
    newTeamIcsUrl,
    newTeamId,
    newTeamName,
    newTeamReplacementFlow,
    newTeamShortName,
    showInfoMessage,
  ]);

  const handleSaveEditedTeam = useCallback(async () => {
    if (!isAdmin) {
      setEditTeamError('Alleen admins mogen teams bewerken.');
      return;
    }

    const teamId = editTeamId.trim().toLowerCase();
    const normalizedName = editTeamName.trim().replace(/\s+/g, ' ');
    const normalizedShortName = editTeamShortName.trim().replace(/\s+/g, ' ');
    const normalizedIcsUrl = editTeamIcsUrl.trim();

    if (!teamId || !normalizedName || !normalizedShortName) {
      setEditTeamError('Naam en short name zijn verplicht.');
      return;
    }

    if (normalizedIcsUrl && !/^https?:\/\//i.test(normalizedIcsUrl)) {
      setEditTeamError('ICS URL moet met http:// of https:// beginnen.');
      return;
    }

    setSavingEditTeam(true);
    setEditTeamError(null);

    try {
      const updated = await updateTeam({
        teamId,
        name: normalizedName,
        shortName: normalizedShortName,
        icsUrl: normalizedIcsUrl,
        enableReplacementFlow: editTeamReplacementFlow,
        active: editTeamActive,
      });

      await loadTeams();
      closeEditTeamModal();
      showInfoMessage(`Team ${updated.team.shortName} is bijgewerkt.`);
    } catch (err: any) {
      setEditTeamError(err.message || 'Team bijwerken mislukt.');
    } finally {
      setSavingEditTeam(false);
    }
  }, [
    closeEditTeamModal,
    editTeamActive,
    editTeamIcsUrl,
    editTeamId,
    editTeamName,
    editTeamReplacementFlow,
    editTeamShortName,
    isAdmin,
    loadTeams,
    showInfoMessage,
  ]);

  const copyBulkImportOverview = useCallback(async () => {
    if (!bulkImportResult) return;

    const text = bulkImportResult.results
      .filter((row) => row.status !== 'error' && row.username)
      .map((row) => `${row.name}: ${row.username}`)
      .join('\n');

    if (!text) {
      setBulkImportError('Geen gebruikersnamen beschikbaar om te kopieren.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        const copied = await copyTextForWeb(text);
        if (!copied) {
          window.prompt('Kopieer dit overzicht:', text);
          return;
        }
        showInfoMessage('Overzicht met gebruikersnamen is gekopieerd.');
        return;
      }

      const result = await Share.share({
        title: 'Nieuwe gebruikersnamen',
        message: text,
      });
      if (result?.action === Share.dismissedAction) return;
      showInfoMessage('Overzicht met gebruikersnamen gedeeld.');
    } catch (err: any) {
      if (isShareCancelError(err)) return;
      setBulkImportError('Kon overzicht niet delen of kopieren.');
    }
  }, [bulkImportResult, copyTextForWeb, isShareCancelError, showInfoMessage]);

  const handleRunBulkImport = useCallback(async () => {
    if (!bulkImportTeamId) {
      setBulkImportError('Kies eerst een team.');
      return;
    }

    if (!bulkImportNamesText.trim()) {
      setBulkImportError('Plak eerst namen (1 naam per regel).');
      return;
    }

    setBulkImportSubmitting(true);
    setBulkImportError(null);

    try {
      const result = await bulkImportTeamPlayers({
        teamId: bulkImportTeamId,
        namesText: bulkImportNamesText,
      });
      setBulkImportResult(result);

      if ((result.summary.created + result.summary.linked) > 0) {
        await loadPlayers();
      }

      if (result.summary.errors === 0) {
        showInfoMessage(`Bulk import voltooid: ${result.summary.total} regels verwerkt.`);
      }
    } catch (err: any) {
      setBulkImportError(err.message || 'Bulk import mislukt.');
      setBulkImportResult(null);
    } finally {
      setBulkImportSubmitting(false);
    }
  }, [bulkImportNamesText, bulkImportTeamId, loadPlayers, showInfoMessage]);

  const handleAddPlayer = useCallback(async () => {
    const name = newPlayerName.trim();
    const username = suggestedUsername;
    if (!name) { setSubmitError('Vul eerst de naam van de speler in.'); return; }
    if (!addPlayerTeamId) { setSubmitError('Kies eerst een team.'); return; }
    if (!allowedAddTeams.some((team) => team.id === addPlayerTeamId)) {
      setSubmitError('Je mag alleen spelers toevoegen aan je eigen team(s).');
      return;
    }
    if (!username) { setSubmitError('Kon geen gebruikersnaam voorstellen op basis van deze naam.'); return; }

    setSubmittingPlayer(true);
    setSubmitError(null);
    try {
      const result = await createOrLinkPlayer({ name, teamId: addPlayerTeamId, username });
      await loadPlayers();
      closeAddPlayerModal();

      const outcomeText = result.result === 'created'
        ? `Speler ${result.player.name} is toegevoegd met gebruikersnaam ${result.player.username}.`
        : result.result === 'linked'
          ? `Bestaande speler ${result.player.name} is ook aan dit team gekoppeld.`
          : `${result.player.name} zat al in dit team.`;

      if (result.result === 'created') {
        if (Platform.OS === 'web') {
          const shouldShare = window.confirm(`${outcomeText}\n\nWil je de inloggegevens nu delen?`);
          if (shouldShare) {
            await shareNewPlayerCredentials(result.player.name, result.player.username);
          }
        } else {
          Alert.alert('Speler aangemaakt', outcomeText, [
            { text: 'Niet delen', style: 'cancel' },
            {
              text: 'Delen',
              onPress: () => {
                void shareNewPlayerCredentials(result.player.name, result.player.username);
              },
            },
          ]);
        }
        return;
      }

      if (Platform.OS === 'web') {
        window.alert(outcomeText);
      } else {
        Alert.alert('Speler verwerkt', outcomeText, [{ text: 'OK' }]);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Speler toevoegen mislukt.');
    } finally {
      setSubmittingPlayer(false);
    }
  }, [
    addPlayerTeamId,
    allowedAddTeams,
    closeAddPlayerModal,
    loadPlayers,
    newPlayerName,
    shareNewPlayerCredentials,
    suggestedUsername,
  ]);

  const visiblePlayers = useMemo(() => {
    if (isAdmin) return players;
    return players.filter((p) => (p.team_ids || []).some((teamId) => manageableTeamIdSet.has(teamId)));
  }, [isAdmin, manageableTeamIdSet, players]);

  const teamLookup = useMemo(() => {
    const map = new Map<string, TeamConfig>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qNormalized = normalizeFilterValue(q);
    if (!q) return visiblePlayers;

    const includesFilter = (value: string): boolean => {
      const raw = (value || '').toLowerCase();
      if (raw.includes(q)) return true;
      return normalizeFilterValue(raw).includes(qNormalized);
    };

    return visiblePlayers.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const username = (p.username || '').toLowerCase();
      const teamSearchText = (p.team_ids || [])
        .map((teamId) => {
          const team = teamLookup.get(teamId) || getTeamConfig(teamId);
          return [teamId, team?.shortName || '', team?.name || ''].join(' ');
        })
        .join(' ')
        .toLowerCase();

      return includesFilter(name) || includesFilter(username) || includesFilter(teamSearchText);
    });
  }, [search, teamLookup, visiblePlayers]);

  const activeCount = filteredPlayers.filter((p) => p.active).length;
  const inactiveCount = filteredPlayers.length - activeCount;

  const selectedCaptainTeamNames = useMemo(() => {
    return draftCaptainTeamIds
      .map((teamId) => getTeamConfig(teamId)?.shortName || teamId)
      .join(', ');
  }, [draftCaptainTeamIds]);

  const selectedNonCountedTeamNames = useMemo(() => {
    return draftNonCountedTeamIds
      .map((teamId) => getTeamConfig(teamId)?.shortName || teamId)
      .join(', ');
  }, [draftNonCountedTeamIds]);

  if (!currentPlayer) return null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Admin Beheer',
          headerLeft: () => (
            <TooltipIconButton
              tooltip="Terug naar games"
              onPress={() => router.replace('/games')}
              style={styles.headerIconBtn}
              accessibilityLabel="Terug naar games"
            >
              <MaterialCommunityIcons name="home" size={28} color={M3.primary} />
            </TooltipIconButton>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Alle spelers</Text>
          <Text style={styles.headerMeta}>Actief: {activeCount} · Inactief: {inactiveCount}</Text>
          <View style={styles.headerActionRow}>
            <TouchableOpacity
              style={[styles.addPlayerBtn, allowedAddTeams.length === 0 && styles.resetBtnDisabled]}
              onPress={() => {
                setAddPlayerTeamId(allowedAddTeams[0]?.id || '');
                setSubmitError(null);
                setAddPlayerVisible(true);
              }}
              disabled={allowedAddTeams.length === 0}
            >
              <MaterialCommunityIcons name="account-plus" size={18} color={M3.onPrimary} />
              <Text style={styles.addPlayerBtnText}>Speler toevoegen</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={styles.secondaryHeaderBtn}
                onPress={() => {
                  setCreateTeamError(null);
                  setAddTeamVisible(true);
                }}
              >
                <MaterialCommunityIcons name="account-group" size={18} color={M3.onSurface} />
                <Text style={styles.secondaryHeaderBtnText}>Team toevoegen</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.secondaryHeaderBtn, (!isAdmin || adminEditableTeams.length === 0) && styles.resetBtnDisabled]}
              onPress={openEditTeamModal}
              disabled={!isAdmin || adminEditableTeams.length === 0}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={M3.onSurface} />
              <Text style={styles.secondaryHeaderBtnText}>Team bewerken</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryHeaderBtn, bulkImportTeams.length === 0 && styles.resetBtnDisabled]}
              onPress={() => {
                setBulkImportError(null);
                setBulkImportResult(null);
                setBulkImportTeamId(bulkImportTeams[0]?.id || '');
                setBulkImportVisible(true);
              }}
              disabled={bulkImportTeams.length === 0}
            >
              <MaterialCommunityIcons name="clipboard-text" size={18} color={M3.onSurface} />
              <Text style={styles.secondaryHeaderBtnText}>Bulk plakken</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={18} color={M3.onSurfaceVariant} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Zoek op naam, gebruikersnaam of team (bijv. VS-1)"
              placeholderTextColor={M3.outline}
              style={styles.searchInput}
              autoCapitalize="none"
            />
            <TooltipIconButton
              tooltip="Spelerslijst vernieuwen"
              onPress={loadPlayers}
              style={styles.refreshBtn}
              accessibilityLabel="Spelerslijst vernieuwen"
            >
              <MaterialCommunityIcons name="refresh" size={18} color={M3.onSurfaceVariant} />
            </TooltipIconButton>
          </View>
        </View>

        {errorMsg && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={M3.absent} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {infoMsg && (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="check-circle" size={16} color={M3.success} />
            <Text style={styles.infoText}>{infoMsg}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={M3.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredPlayers}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Geen spelers gevonden.</Text>
            }
            renderItem={({ item }) => {
              const visibleCaptainTeamIds = (item.captain_team_ids || []).filter(
                (teamId) => isAdmin || manageableTeamIdSet.has(teamId)
              );
              const visibleNonCountedTeamIds = (item.not_counted_team_ids || []).filter(
                (teamId) => isAdmin || manageableTeamIdSet.has(teamId)
              );
              const captainTeamsLabel = visibleCaptainTeamIds
                .map((teamId) => getTeamConfig(teamId)?.shortName || teamId)
                .join(', ');
              const nonCountedTeamsLabel = visibleNonCountedTeamIds
                .map((teamId) => getTeamConfig(teamId)?.shortName || teamId)
                .join(', ');

              return (
              <View style={[styles.playerRow, !item.active && styles.playerRowInactive]}>
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, !item.active && styles.playerNameInactive]}>
                    {item.name}
                  </Text>
                  <Text style={styles.playerUsername}>{item.username}</Text>
                  <View style={styles.teamChipsRow}>
                    {(item.team_ids || []).length === 0 ? (
                      <Text style={styles.noTeamText}>Geen team</Text>
                    ) : (
                      (item.team_ids || []).map((teamId) => {
                        const team = getTeamConfig(teamId);
                        if (!isAdmin && !manageableTeamIdSet.has(teamId)) return null;
                        return (
                          <View key={`${item.id}-${teamId}`} style={styles.teamChipInline}>
                            <Text style={styles.teamChipInlineText}>
                              {team?.shortName || teamId}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                  {visibleCaptainTeamIds.length > 0 && (
                    <View style={styles.captainInfoRow}>
                      <MaterialCommunityIcons name="crown" size={14} color={M3.warning} />
                      <Text style={styles.captainInfoText}>Captain: {captainTeamsLabel}</Text>
                    </View>
                  )}
                  {visibleNonCountedTeamIds.length > 0 && (
                    <View style={styles.nonCountedInfoRow}>
                      <MaterialCommunityIcons name="account-off-outline" size={14} color={M3.onSurfaceVariant} />
                      <Text style={styles.nonCountedInfoText}>Niet meetellen: {nonCountedTeamsLabel}</Text>
                    </View>
                  )}
                  {!item.active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Inactief</Text>
                    </View>
                  )}
                </View>
                <View style={styles.actions}>
                  {canEditPlayerIdentity(item) && (
                    <TooltipIconButton
                      tooltip="Naam en gebruikersnaam wijzigen"
                      style={styles.profileEditBtn}
                      onPress={() => openEditPlayerModal(item)}
                      accessibilityLabel={`Wijzig spelergegevens van ${item.name}`}
                    >
                      <MaterialCommunityIcons name="account-edit" size={20} color={M3.onSurfaceVariant} />
                    </TooltipIconButton>
                  )}
                  {(isAdmin || (canAssignCaptains
                    && currentPlayer
                    && item.id !== currentPlayer.id
                    && (item.team_ids || []).some((teamId) => captainManagedTeamIdSet.has(teamId)))) && (
                    <TooltipIconButton
                      tooltip="Teams/Captainrechten beheren"
                      style={styles.teamEditBtn}
                      onPress={() => openTeamModal(item)}
                      accessibilityLabel={`Beheer teams of captainrechten voor ${item.name}`}
                    >
                      <MaterialCommunityIcons name="account-group" size={19} color={M3.onSurfaceVariant} />
                    </TooltipIconButton>
                  )}
                  <TooltipIconButton
                    tooltip="Deel inloggegevens"
                    style={[styles.shareBtn, !item.username && styles.resetBtnDisabled]}
                    onPress={() => { void shareNewPlayerCredentials(item.name, item.username); }}
                    disabled={!item.username}
                    accessibilityLabel={`Deel inloggegevens van ${item.name}`}
                  >
                    <MaterialCommunityIcons
                      name="share-variant"
                      size={20}
                      color={item.username ? M3.onSurfaceVariant : M3.outline}
                    />
                  </TooltipIconButton>
                  {/* Reset password */}
                  <TooltipIconButton
                    tooltip="Reset wachtwoord"
                    style={[styles.resetBtn, (!item.auth_user_id || resettingId === item.id) && styles.resetBtnDisabled]}
                    onPress={() => handleResetPassword(item)}
                    disabled={!item.auth_user_id || resettingId !== null}
                    accessibilityLabel={`Reset wachtwoord van ${item.name}`}
                  >
                    {resettingId === item.id
                      ? <ActivityIndicator size="small" color={M3.onSurfaceVariant} />
                      : <MaterialCommunityIcons
                          name="lock-reset"
                          size={20}
                          color={item.auth_user_id ? M3.onSurfaceVariant : M3.outline}
                        />
                    }
                  </TooltipIconButton>

                  {/* Active toggle */}
                  {togglingId === item.id
                    ? <ActivityIndicator size="small" color={M3.primary} style={{ marginLeft: spacing.sm }} />
                    : <TooltipHover tooltip={item.active ? 'Deactiveer speler' : 'Activeer speler'}>
                        <Switch
                          value={item.active}
                          onValueChange={() => handleToggleActive(item)}
                          thumbColor={item.active ? M3.primary : M3.outline}
                          trackColor={{ false: M3.surfaceContainerHighest, true: M3.primaryContainer }}
                          disabled={togglingId !== null}
                          accessibilityLabel={item.active ? `Deactiveer ${item.name}` : `Activeer ${item.name}`}
                        />
                      </TooltipHover>
                  }
                </View>
              </View>
            );
            }}
          />
        )}

        <Modal
          transparent
          animationType="fade"
          visible={teamModalVisible}
          onRequestClose={() => setTeamModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTapZone} onPress={() => setTeamModalVisible(false)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{isAdmin ? 'Teams beheren' : 'Team/Captain beheren'}</Text>
              <Text style={styles.modalSubtitle}>{teamModalPlayer?.name || ''}</Text>
              <Text style={styles.modalHintText}>Vink een team uit om de speler uit dat team te verwijderen.</Text>
              <Text style={styles.modalCaptainSummaryText}>
                Captainstatus: {selectedCaptainTeamNames || 'Geen'}
              </Text>
              <Text style={styles.modalNoCountSummaryText}>
                Niet meetellen: {selectedNonCountedTeamNames || 'Geen'}
              </Text>

              <View style={styles.modalTeamList}>
                {modalTeams.map((team) => {
                  const selected = draftTeamIds.includes(team.id);
                  const isCaptain = selected && draftCaptainTeamIds.includes(team.id);
                  const isNonCounted = selected && draftNonCountedTeamIds.includes(team.id);
                  return (
                    <View
                      key={team.id}
                      style={[styles.modalTeamRow, selected && styles.modalTeamRowActive]}
                    >
                      <View style={styles.modalTeamLabelColumn}>
                        <Text style={[styles.modalTeamRowText, selected && styles.modalTeamRowTextActive]}>
                          {team.shortName}
                        </Text>
                        {isCaptain && <Text style={styles.modalCaptainBadgeText}>Captain</Text>}
                        {isNonCounted && <Text style={styles.modalNoCountBadgeText}>Niet meetellen</Text>}
                      </View>
                      <View style={styles.modalTeamActions}>
                        <TooltipIconButton
                          tooltip={selected ? 'Verwijder uit team' : 'Voeg toe aan team'}
                          onPress={() => toggleDraftTeam(team.id)}
                          style={styles.modalIconTapTarget}
                          accessibilityLabel={`Team ${team.shortName} ${selected ? 'verwijderen' : 'toevoegen'}`}
                        >
                          <MaterialCommunityIcons
                            name={selected ? 'account-minus' : 'account-plus'}
                            size={18}
                            color={selected ? M3.absent : M3.primary}
                          />
                        </TooltipIconButton>
                        <TooltipIconButton
                          tooltip={draftCaptainTeamIds.includes(team.id) ? 'Maak geen captain' : 'Maak captain'}
                          onPress={() => toggleDraftCaptainTeam(team.id)}
                          disabled={!selected}
                          style={styles.modalIconTapTarget}
                          accessibilityLabel={`Captainrechten voor ${team.shortName} ${draftCaptainTeamIds.includes(team.id) ? 'uitzetten' : 'aanzetten'}`}
                        >
                          <MaterialCommunityIcons
                            name={(selected && draftCaptainTeamIds.includes(team.id)) ? 'crown' : 'crown-outline'}
                            size={18}
                            color={selected ? M3.warning : M3.outline}
                          />
                        </TooltipIconButton>
                        <TooltipIconButton
                          tooltip={draftNonCountedTeamIds.includes(team.id)
                            ? 'Wel meetellen in spelerslijst'
                            : 'Niet meetellen in spelerslijst'}
                          onPress={() => toggleDraftNonCountedTeam(team.id)}
                          disabled={!selected || !isAdmin}
                          style={styles.modalIconTapTarget}
                          accessibilityLabel={`Niet meetellen in spelerslijst voor ${team.shortName} ${draftNonCountedTeamIds.includes(team.id) ? 'uitzetten' : 'aanzetten'}`}
                        >
                          <MaterialCommunityIcons
                            name={(selected && draftNonCountedTeamIds.includes(team.id)) ? 'account-off' : 'account-off-outline'}
                            size={18}
                            color={selected ? M3.onSurfaceVariant : M3.outline}
                          />
                        </TooltipIconButton>
                      </View>
                    </View>
                  );
                })}
              </View>

              {!isAdmin && modalTeams.length === 0 && (
                <Text style={styles.formErrorText}>Geen gedeelde teams gevonden om captainrechten te beheren.</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTeamModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingTeams && styles.resetBtnDisabled]}
                  onPress={saveTeams}
                  disabled={savingTeams}
                >
                  {savingTeams
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={styles.modalSaveText}>Opslaan</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={editPlayerVisible}
          onRequestClose={closeEditPlayerModal}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTapZone} onPress={closeEditPlayerModal} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Spelergegevens wijzigen</Text>
              <Text style={styles.modalSubtitle}>{editPlayerTarget?.name || ''}</Text>

              <Text style={styles.formLabel}>Naam</Text>
              <TextInput
                style={styles.formInput}
                value={editPlayerName}
                onChangeText={setEditPlayerName}
                placeholder="Bijv. Jan Jansen"
                placeholderTextColor={M3.outline}
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Gebruikersnaam</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMonospace]}
                value={editPlayerUsername}
                onChangeText={(value) => setEditPlayerUsername(value.replace(/\s+/g, '').toLowerCase())}
                placeholder="bijv. jan.jansen"
                placeholderTextColor={M3.outline}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.formHelpText}>Alleen kleine letters, cijfers, punt, streepje en underscore.</Text>

              {editPlayerError && <Text style={styles.formErrorText}>{editPlayerError}</Text>}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEditPlayerModal}>
                  <Text style={styles.modalCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingPlayerProfile && styles.resetBtnDisabled]}
                  onPress={savePlayerProfile}
                  disabled={savingPlayerProfile}
                >
                  {savingPlayerProfile
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={styles.modalSaveText}>Opslaan</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={addPlayerVisible}
          onRequestClose={closeAddPlayerModal}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTapZone} onPress={closeAddPlayerModal} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Speler toevoegen</Text>
              <Text style={styles.modalSubtitle}>
                Maak een speler aan of koppel een bestaande gebruiker aan een team.
              </Text>

              <Text style={styles.formLabel}>Naam</Text>
              <TextInput
                style={styles.formInput}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                placeholder="Bijv. Jan Jansen"
                placeholderTextColor={M3.outline}
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Voorgestelde gebruikersnaam</Text>
              <View style={styles.generatedUsernameBox}>
                <Text style={styles.generatedUsernameText}>{suggestedUsername || 'Nog geen voorstel'}</Text>
              </View>

              <Text style={styles.formLabel}>Team</Text>
              <View style={styles.teamPickerRow}>
                {allowedAddTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamChoiceChip, addPlayerTeamId === team.id && styles.teamChoiceChipActive]}
                    onPress={() => setAddPlayerTeamId(team.id)}
                  >
                    <Text style={[styles.teamChoiceText, addPlayerTeamId === team.id && styles.teamChoiceTextActive]}>
                      {team.shortName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {allowedAddTeams.length === 0 && (
                <Text style={styles.formErrorText}>Je beheert geen teams en kunt daarom geen spelers toevoegen.</Text>
              )}

              {submitError && <Text style={styles.formErrorText}>{submitError}</Text>}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeAddPlayerModal}>
                  <Text style={styles.modalCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, submittingPlayer && styles.resetBtnDisabled]}
                  onPress={handleAddPlayer}
                  disabled={submittingPlayer || allowedAddTeams.length === 0}
                >
                  {submittingPlayer
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={styles.modalSaveText}>Opslaan</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={addTeamVisible}
          onRequestClose={closeAddTeamModal}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTapZone} onPress={closeAddTeamModal} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Team toevoegen</Text>
              <Text style={styles.modalSubtitle}>Nieuwe teams en instellingen worden in de database opgeslagen.</Text>

              <Text style={styles.formLabel}>Team-id</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMonospace]}
                value={newTeamId}
                onChangeText={(value) => setNewTeamId(value.replace(/\s+/g, '').toLowerCase())}
                placeholder="bijv. vs3"
                placeholderTextColor={M3.outline}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.formLabel}>Naam</Text>
              <TextInput
                style={styles.formInput}
                value={newTeamName}
                onChangeText={setNewTeamName}
                placeholder="bijv. Quick Amsterdam VS-3"
                placeholderTextColor={M3.outline}
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Short name</Text>
              <TextInput
                style={styles.formInput}
                value={newTeamShortName}
                onChangeText={setNewTeamShortName}
                placeholder="bijv. VS-3"
                placeholderTextColor={M3.outline}
                autoCapitalize="characters"
              />

              <Text style={styles.formLabel}>ICS URL</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMonospace]}
                value={newTeamIcsUrl}
                onChangeText={setNewTeamIcsUrl}
                placeholder="https://.../team/ics"
                placeholderTextColor={M3.outline}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.inlineSwitchRow}>
                <Text style={styles.inlineSwitchLabel}>Vervangersflow aan</Text>
                <Switch
                  value={newTeamReplacementFlow}
                  onValueChange={setNewTeamReplacementFlow}
                  thumbColor={newTeamReplacementFlow ? M3.primary : M3.outline}
                  trackColor={{ false: M3.surfaceContainerHighest, true: M3.primaryContainer }}
                />
              </View>

              <View style={styles.inlineSwitchRow}>
                <Text style={styles.inlineSwitchLabel}>Team actief</Text>
                <Switch
                  value={newTeamActive}
                  onValueChange={setNewTeamActive}
                  thumbColor={newTeamActive ? M3.primary : M3.outline}
                  trackColor={{ false: M3.surfaceContainerHighest, true: M3.primaryContainer }}
                />
              </View>

              {createTeamError && <Text style={styles.formErrorText}>{createTeamError}</Text>}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeAddTeamModal}>
                  <Text style={styles.modalCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, creatingTeam && styles.resetBtnDisabled]}
                  onPress={handleCreateTeam}
                  disabled={creatingTeam}
                >
                  {creatingTeam
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={styles.modalSaveText}>Aanmaken</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={editTeamVisible}
          onRequestClose={closeEditTeamModal}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTapZone} onPress={closeEditTeamModal} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Team bewerken</Text>
              <Text style={styles.modalSubtitle}>Pas bestaande team-instellingen aan in de database.</Text>

              <Text style={styles.formLabel}>Team</Text>
              <View style={styles.teamPickerRow}>
                {adminEditableTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamChoiceChip, editTeamId === team.id && styles.teamChoiceChipActive]}
                    onPress={() => {
                      applyEditTeamForm(team);
                      setEditTeamError(null);
                    }}
                  >
                    <Text style={[styles.teamChoiceText, editTeamId === team.id && styles.teamChoiceTextActive]}>
                      {team.shortName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Naam</Text>
              <TextInput
                style={styles.formInput}
                value={editTeamName}
                onChangeText={setEditTeamName}
                placeholder="bijv. Quick Amsterdam VS-3"
                placeholderTextColor={M3.outline}
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Short name</Text>
              <TextInput
                style={styles.formInput}
                value={editTeamShortName}
                onChangeText={setEditTeamShortName}
                placeholder="bijv. VS-3"
                placeholderTextColor={M3.outline}
                autoCapitalize="characters"
              />

              <Text style={styles.formLabel}>ICS URL</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMonospace]}
                value={editTeamIcsUrl}
                onChangeText={setEditTeamIcsUrl}
                placeholder="https://.../team/ics"
                placeholderTextColor={M3.outline}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.inlineSwitchRow}>
                <Text style={styles.inlineSwitchLabel}>Vervangersflow aan</Text>
                <Switch
                  value={editTeamReplacementFlow}
                  onValueChange={setEditTeamReplacementFlow}
                  thumbColor={editTeamReplacementFlow ? M3.primary : M3.outline}
                  trackColor={{ false: M3.surfaceContainerHighest, true: M3.primaryContainer }}
                />
              </View>

              <View style={styles.inlineSwitchRow}>
                <Text style={styles.inlineSwitchLabel}>Team actief</Text>
                <Switch
                  value={editTeamActive}
                  onValueChange={setEditTeamActive}
                  thumbColor={editTeamActive ? M3.primary : M3.outline}
                  trackColor={{ false: M3.surfaceContainerHighest, true: M3.primaryContainer }}
                />
              </View>

              {editTeamError && <Text style={styles.formErrorText}>{editTeamError}</Text>}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEditTeamModal}>
                  <Text style={styles.modalCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingEditTeam && styles.resetBtnDisabled]}
                  onPress={handleSaveEditedTeam}
                  disabled={savingEditTeam}
                >
                  {savingEditTeam
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={styles.modalSaveText}>Opslaan</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={bulkImportVisible}
          onRequestClose={closeBulkImportModal}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTapZone} onPress={closeBulkImportModal} />
            <View style={[styles.modalCard, styles.modalCardLarge]}>
              <Text style={styles.modalTitle}>Bulk teamleden toevoegen</Text>
              <Text style={styles.modalSubtitle}>Plak 1 naam per regel. Bestaande spelers worden gekoppeld, nieuwe spelers worden aangemaakt.</Text>

              <Text style={styles.formLabel}>Team</Text>
              <View style={styles.teamPickerRow}>
                {bulkImportTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamChoiceChip, bulkImportTeamId === team.id && styles.teamChoiceChipActive]}
                    onPress={() => setBulkImportTeamId(team.id)}
                  >
                    <Text style={[styles.teamChoiceText, bulkImportTeamId === team.id && styles.teamChoiceTextActive]}>
                      {team.shortName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Namen (1 per regel)</Text>
              <TextInput
                style={[styles.formInput, styles.bulkTextArea]}
                value={bulkImportNamesText}
                onChangeText={setBulkImportNamesText}
                placeholder={'Bijv.\nJan Jansen\nPiet Pieters'}
                placeholderTextColor={M3.outline}
                multiline
                textAlignVertical="top"
                autoCapitalize="words"
              />

              {bulkImportError && <Text style={styles.formErrorText}>{bulkImportError}</Text>}

              {bulkImportResult && (
                <View style={styles.bulkResultBox}>
                  <Text style={styles.bulkResultSummary}>
                    Verwerkt: {bulkImportResult.summary.total} · Nieuw: {bulkImportResult.summary.created} · Gekoppeld: {bulkImportResult.summary.linked} · Bestond al: {bulkImportResult.summary.alreadyLinked} · Fouten: {bulkImportResult.summary.errors}
                  </Text>
                  <View style={styles.bulkResultRows}>
                    {bulkImportResult.results.slice(0, 25).map((row) => (
                      <Text key={`${row.lineNumber}-${row.name}`} style={styles.bulkResultRowText}>
                        {row.lineNumber}. {row.name} - {row.username || '-'} ({row.status}){row.error ? `: ${row.error}` : ''}
                      </Text>
                    ))}
                    {bulkImportResult.results.length > 25 && (
                      <Text style={styles.bulkResultMoreText}>...en {bulkImportResult.results.length - 25} extra regels.</Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeBulkImportModal}>
                  <Text style={styles.modalCancelText}>Sluiten</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => { void copyBulkImportOverview(); }}
                  disabled={!bulkImportResult}
                >
                  <Text style={styles.modalSecondaryBtnText}>Kopieer overzicht</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, bulkImportSubmitting && styles.resetBtnDisabled]}
                  onPress={handleRunBulkImport}
                  disabled={bulkImportSubmitting || bulkImportTeams.length === 0}
                >
                  {bulkImportSubmitting
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={styles.modalSaveText}>Importeren</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: M3.surfaceContainer,
  },
  headerBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: M3.surface,
    borderBottomWidth: 1,
    borderBottomColor: M3.outlineVariant,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: M3.onSurface,
    fontWeight: '700',
  },
  headerMeta: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    marginTop: 2,
  },
  headerActionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: M3.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  addPlayerBtnText: {
    ...typography.labelLarge,
    color: M3.onPrimary,
    fontWeight: '600',
  },
  secondaryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: M3.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  secondaryHeaderBtnText: {
    ...typography.labelLarge,
    color: M3.onSurface,
    fontWeight: '600',
  },
  searchRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: M3.surfaceContainerHigh,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyMedium,
    color: M3.onSurface,
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: M3.absentContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: M3.absent,
    ...typography.bodySmall,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: M3.successContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    flex: 1,
    color: M3.success,
    ...typography.bodySmall,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: M3.outlineVariant,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: M3.surface,
  },
  playerRowInactive: {
    opacity: 0.55,
  },
  playerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  playerName: {
    ...typography.bodyLarge,
    color: M3.onSurface,
    fontWeight: '500',
  },
  playerNameInactive: {
    textDecorationLine: 'line-through',
    color: M3.onSurfaceVariant,
  },
  playerUsername: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  teamChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  teamChipInline: {
    backgroundColor: M3.secondaryContainer,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 2,
  },
  teamChipInlineText: {
    ...typography.labelSmall,
    color: M3.onSecondaryContainer,
  },
  captainInfoRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  captainInfoText: {
    ...typography.labelSmall,
    color: M3.warning,
    fontWeight: '600',
  },
  nonCountedInfoRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nonCountedInfoText: {
    ...typography.labelSmall,
    color: M3.onSurfaceVariant,
    fontWeight: '600',
  },
  noTeamText: {
    ...typography.labelSmall,
    color: M3.outline,
    fontStyle: 'italic',
  },
  inactiveBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: M3.absentContainer,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  inactiveBadgeText: {
    fontSize: 11,
    color: M3.absent,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: M3.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: M3.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnDisabled: {
    opacity: 0.4,
  },
  teamEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: M3.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: M3.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: M3.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  modalCardLarge: {
    maxWidth: 620,
  },
  modalTitle: {
    ...typography.titleMedium,
    color: M3.onSurface,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modalHintText: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  modalCaptainSummaryText: {
    ...typography.bodySmall,
    color: M3.warning,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  modalNoCountSummaryText: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  modalTeamList: {
    gap: spacing.xs,
  },
  modalTeamRow: {
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTeamActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  modalTeamLabelColumn: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  modalCaptainBadgeText: {
    ...typography.labelSmall,
    color: M3.warning,
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalNoCountBadgeText: {
    ...typography.labelSmall,
    color: M3.onSurfaceVariant,
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalIconTapTarget: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTeamRowActive: {
    borderColor: M3.primary,
    backgroundColor: M3.primaryContainer,
  },
  modalTeamRowText: {
    ...typography.bodyMedium,
    color: M3.onSurface,
  },
  modalTeamRowTextActive: {
    color: M3.onPrimaryContainer,
    fontWeight: '600',
  },
  modalActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    ...typography.labelLarge,
    color: M3.onSurfaceVariant,
  },
  modalSaveBtn: {
    backgroundColor: M3.primary,
    borderRadius: radii.full,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalSaveText: {
    ...typography.labelLarge,
    color: M3.onPrimary,
    fontWeight: '700',
  },
  formLabel: {
    ...typography.labelMedium,
    color: M3.onSurfaceVariant,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  formInput: {
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: M3.onSurface,
    backgroundColor: M3.surface,
  },
  formInputMonospace: {
    fontFamily: 'monospace',
  },
  formHelpText: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  inlineSwitchRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: M3.surfaceContainerHigh,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineSwitchLabel: {
    ...typography.bodyMedium,
    color: M3.onSurface,
    fontWeight: '600',
  },
  generatedUsernameBox: {
    backgroundColor: M3.secondaryContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  generatedUsernameText: {
    ...typography.bodyMedium,
    color: M3.onSecondaryContainer,
    fontFamily: 'monospace',
  },
  teamPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  teamChoiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: M3.outline,
  },
  teamChoiceChipActive: {
    backgroundColor: M3.primaryContainer,
    borderColor: M3.primary,
  },
  teamChoiceText: {
    ...typography.labelMedium,
    color: M3.onSurface,
  },
  teamChoiceTextActive: {
    color: M3.onPrimaryContainer,
    fontWeight: '700',
  },
  formErrorText: {
    ...typography.bodySmall,
    color: M3.absent,
    marginTop: spacing.sm,
  },
  bulkTextArea: {
    minHeight: 140,
    maxHeight: 220,
  },
  bulkResultBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    borderRadius: radii.md,
    backgroundColor: M3.surfaceContainerHigh,
    padding: spacing.sm,
  },
  bulkResultSummary: {
    ...typography.bodySmall,
    color: M3.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  bulkResultRows: {
    gap: 2,
  },
  bulkResultRowText: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  bulkResultMoreText: {
    ...typography.bodySmall,
    color: M3.onSurfaceVariant,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  modalSecondaryBtn: {
    backgroundColor: M3.surfaceContainerHigh,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalSecondaryBtnText: {
    ...typography.labelLarge,
    color: M3.onSurface,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.bodyMedium,
    color: M3.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  tooltipAnchor: {
    position: 'relative',
  },
  tooltipBubble: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: [{ translateX: -70 }],
    minWidth: 140,
    maxWidth: 180,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: 6,
    zIndex: 999,
  },
  tooltipText: {
    ...typography.labelSmall,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
