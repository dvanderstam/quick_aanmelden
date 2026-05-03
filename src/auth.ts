import { supabase } from './supabase';
import { Player } from './types';

const EMAIL_DOMAIN = 'quick.local';
const AUTH_LOCK_STEAL_FRAGMENT = "Lock broken by another request with the 'steal' option";

function isAuthLockStealError(error: unknown): boolean {
  const message = String((error as any)?.message || '');
  return message.includes(AUTH_LOCK_STEAL_FRAGMENT);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlayer(row: any): Player {
  return {
    ...row,
    active: row?.active ?? true,
  } as Player;
}

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
}

function getFunctionUrl(path: string): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  if (typeof window === 'undefined') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL ontbreekt voor deze omgeving.');
  }

  return path;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Wachtwoord moet minimaal 8 tekens zijn.';
  if (!/[A-Z]/.test(password)) return 'Wachtwoord moet minimaal 1 hoofdletter bevatten.';
  if (!/[0-9]/.test(password)) return 'Wachtwoord moet minimaal 1 cijfer bevatten.';
  return null;
}

export async function signIn(username: string, password: string) {
  const email = usernameToEmail(username);
  let data: any = null;
  let error: any = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    data = result.data;
    error = result.error;

    // This can happen when two auth calls overlap (multi-tab or double submit).
    if (!error || !isAuthLockStealError(error) || attempt === 1) break;
    await sleep(120);
  }

  if (error) {
    if (isAuthLockStealError(error)) {
      throw new Error('Inloggen was tegelijk op meerdere plekken bezig. Probeer nog een keer.');
    }
    throw new Error('Ongeldige gebruikersnaam of wachtwoord.');
  }

  const authUserId = data.user?.id;
  if (!authUserId) {
    await supabase.auth.signOut();
    throw new Error('Inloggen mislukt. Probeer opnieuw.');
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('active')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (playerError) {
    await supabase.auth.signOut();
    throw new Error('Kon accountstatus niet controleren. Probeer opnieuw.');
  }

  if (!player || player.active === false) {
    await supabase.auth.signOut();
    throw new Error('Dit account is gedeactiveerd. Neem contact op met een beheerder.');
  }

  return data;
}

export async function signUp(username: string, password: string) {
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  // Check if username exists and is unclaimed
  const { data: player, error: lookupError } = await supabase
    .from('players')
    .select('*')
    .eq('username', username.toLowerCase().trim())
    .is('auth_user_id', null)
    .maybeSingle();

  if (lookupError) throw new Error('Kon speler niet opzoeken.');
  if (!player) throw new Error('Gebruikersnaam niet gevonden of al in gebruik.');

  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error('Account aanmaken mislukt: ' + error.message);

  if (data.user) {
    const { error: claimError } = await supabase
      .from('players')
      .update({ auth_user_id: data.user.id })
      .eq('id', player.id)
      .is('auth_user_id', null);

    if (claimError) {
      await supabase.auth.signOut();
      throw new Error('Kon speler niet koppelen. Probeer het opnieuw.');
    }
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!player) return null;
  if (player.active === false) return null;

  // Fetch team memberships
  let teams: Array<{ team_id: string; is_team_captain?: boolean; count_in_player_list?: boolean }> = [];
  const teamsWithCount = await supabase
    .from('player_teams')
    .select('team_id, is_team_captain, count_in_player_list')
    .eq('player_id', player.id);

  if (teamsWithCount.error && /count_in_player_list/i.test(teamsWithCount.error.message || '')) {
    const fallback = await supabase
      .from('player_teams')
      .select('team_id, is_team_captain')
      .eq('player_id', player.id);

    if (fallback.error) throw fallback.error;
    teams = (fallback.data || []).map((row: { team_id: string; is_team_captain?: boolean }) => ({
      ...row,
      count_in_player_list: true,
    }));
  } else {
    if (teamsWithCount.error) throw teamsWithCount.error;
    teams = (teamsWithCount.data || []).map((row: { team_id: string; is_team_captain?: boolean; count_in_player_list?: boolean }) => ({
      ...row,
      count_in_player_list: row.count_in_player_list !== false,
    }));
  }

  return {
    ...normalizePlayer(player),
    team_ids: teams?.map((t: { team_id: string }) => t.team_id) || [],
    captain_team_ids:
      teams
        ?.filter((t: { team_id: string; is_team_captain?: boolean }) => !!t.is_team_captain)
        .map((t: { team_id: string }) => t.team_id) || [],
    not_counted_team_ids:
      teams
        ?.filter((t: { team_id: string; count_in_player_list?: boolean }) => t.count_in_player_list === false)
        .map((t: { team_id: string }) => t.team_id) || [],
  };
}

export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');

  if (error) throw error;
  const players = (data || []).map(normalizePlayer);

  let memberships: Array<{
    player_id: number;
    team_id: string;
    is_team_captain?: boolean;
    count_in_player_list?: boolean;
  }> = [];

  const membershipsWithCount = await supabase
    .from('player_teams')
    .select('player_id, team_id, is_team_captain, count_in_player_list');

  if (membershipsWithCount.error && /count_in_player_list/i.test(membershipsWithCount.error.message || '')) {
    const fallback = await supabase
      .from('player_teams')
      .select('player_id, team_id, is_team_captain');

    if (fallback.error) throw fallback.error;
    memberships = (fallback.data || []).map((row: {
      player_id: number;
      team_id: string;
      is_team_captain?: boolean;
    }) => ({
      ...row,
      count_in_player_list: true,
    }));
  } else {
    if (membershipsWithCount.error) throw membershipsWithCount.error;
    memberships = (membershipsWithCount.data || []).map((row: {
      player_id: number;
      team_id: string;
      is_team_captain?: boolean;
      count_in_player_list?: boolean;
    }) => ({
      ...row,
      count_in_player_list: row.count_in_player_list !== false,
    }));
  }

  const membershipByPlayer = new Map<number, {
    team_ids: string[];
    captain_team_ids: string[];
    not_counted_team_ids: string[];
  }>();
  for (const row of memberships || []) {
    const playerId = row.player_id as number;
    const teamId = row.team_id as string;
    const isCaptain = !!row.is_team_captain;
    const isCounted = row.count_in_player_list !== false;

    const existing = membershipByPlayer.get(playerId) || {
      team_ids: [],
      captain_team_ids: [],
      not_counted_team_ids: [],
    };
    existing.team_ids.push(teamId);
    if (isCaptain) existing.captain_team_ids.push(teamId);
    if (!isCounted) existing.not_counted_team_ids.push(teamId);
    membershipByPlayer.set(playerId, existing);
  }

  return players.map((player) => {
    const membership = membershipByPlayer.get(player.id);
    return {
      ...player,
      team_ids: membership?.team_ids || [],
      captain_team_ids: membership?.captain_team_ids || [],
      not_counted_team_ids: membership?.not_counted_team_ids || [],
    };
  });
}

export async function getPlayersForTeam(teamId: string): Promise<Player[]> {
  let memberships: Array<{ player_id: number; count_in_player_list?: boolean }> = [];
  const membershipsWithCount = await supabase
    .from('player_teams')
    .select('player_id, count_in_player_list')
    .eq('team_id', teamId);

  if (membershipsWithCount.error && /count_in_player_list/i.test(membershipsWithCount.error.message || '')) {
    const fallback = await supabase
      .from('player_teams')
      .select('player_id')
      .eq('team_id', teamId);

    if (fallback.error) throw fallback.error;
    memberships = (fallback.data || []).map((row: { player_id: number }) => ({
      ...row,
      count_in_player_list: true,
    }));
  } else {
    if (membershipsWithCount.error) throw membershipsWithCount.error;
    memberships = (membershipsWithCount.data || []).map((row: { player_id: number; count_in_player_list?: boolean }) => ({
      ...row,
      count_in_player_list: row.count_in_player_list !== false,
    }));
  }

  const playerIds = memberships
    .filter((membership) => membership.count_in_player_list !== false)
    .map((membership) => membership.player_id);
  if (playerIds.length === 0) return [];

  let { data: players, error: pError } = await supabase
    .from('players')
    .select('*')
    .in('id', playerIds)
    .eq('active', true)
    .order('name');

  // Compatibility fallback while migration_v16 is not yet applied.
  if (pError && /active/i.test(pError.message || '')) {
    const fallback = await supabase
      .from('players')
      .select('*')
      .in('id', playerIds)
      .order('name');

    pError = fallback.error;
    players = fallback.data;
  }

  if (pError) throw pError;
  return (players || [])
    .map(normalizePlayer)
    .filter((p) => p.active !== false)
    .map((p) => ({ ...p, count_in_player_list: true }));
}

export async function getAllPlayersForTeam(teamId: string): Promise<Player[]> {
  let memberships: Array<{ player_id: number; count_in_player_list?: boolean }> = [];
  const withCount = await supabase
    .from('player_teams')
    .select('player_id, count_in_player_list')
    .eq('team_id', teamId);

  if (withCount.error && /count_in_player_list/i.test(withCount.error.message || '')) {
    const fallback = await supabase
      .from('player_teams')
      .select('player_id')
      .eq('team_id', teamId);

    if (fallback.error) throw fallback.error;
    memberships = (fallback.data || []).map((row: { player_id: number }) => ({
      ...row,
      count_in_player_list: true,
    }));
  } else {
    if (withCount.error) throw withCount.error;
    memberships = (withCount.data || []).map((row: { player_id: number; count_in_player_list?: boolean }) => ({
      ...row,
      count_in_player_list: row.count_in_player_list !== false,
    }));
  }

  const playerIds = memberships.map((r) => r.player_id);
  if (playerIds.length === 0) return [];

  const { data: players, error: pError } = await supabase
    .from('players')
    .select('*')
    .in('id', playerIds)
    .order('name');

  if (pError) throw pError;
  const countByPlayer = new Map<number, boolean>();
  for (const row of memberships || []) {
    countByPlayer.set(row.player_id as number, row.count_in_player_list !== false);
  }

  return (players || []).map(normalizePlayer).map((player) => ({
    ...player,
    count_in_player_list: countByPlayer.get(player.id) !== false,
  }));
}

export function canManageTeam(currentPlayer: Player, teamId: string): boolean {
  if (currentPlayer.role === 'admin') return true;
  if (currentPlayer.role === 'teamAdmin' && currentPlayer.team_ids?.includes(teamId)) return true;
  if (currentPlayer.captain_team_ids?.includes(teamId)) return true;
  return false;
}

export function canEditPlayer(currentPlayer: Player, targetPlayerId: number, teamId: string): boolean {
  if (canManageTeam(currentPlayer, teamId)) return true;
  return currentPlayer.id === targetPlayerId;
}

export async function changePassword(newPassword: string): Promise<void> {
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error('Wachtwoord wijzigen mislukt: ' + error.message);

  // Mark password as changed
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('players')
      .update({ must_change_password: false })
      .eq('auth_user_id', user.id);
  }
}

export async function acceptDisclaimer(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('players')
      .update({ disclaimer_accepted: true })
      .eq('auth_user_id', user.id);
  }
}

export async function resetForgottenPassword(
  username: string,
  newPassword: string
): Promise<void> {
  const normalizedUsername = username.toLowerCase().trim();

  if (!normalizedUsername) {
    throw new Error('Vul je gebruikersnaam in.');
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const response = await fetch(getFunctionUrl('/.netlify/functions/reset-forgotten-password'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: normalizedUsername, newPassword }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Wachtwoord resetten mislukt.');
  }
}
