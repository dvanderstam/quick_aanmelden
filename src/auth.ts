import { supabase } from './supabase';
import { Player } from './types';
import { DEFAULT_PASSWORD } from './config';

const EMAIL_DOMAIN = 'quick.local';

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Wachtwoord moet minimaal 8 tekens zijn.';
  if (!/[A-Z]/.test(password)) return 'Wachtwoord moet minimaal 1 hoofdletter bevatten.';
  if (!/[0-9]/.test(password)) return 'Wachtwoord moet minimaal 1 cijfer bevatten.';
  return null;
}

export async function signIn(username: string, password: string) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error('Ongeldige gebruikersnaam of wachtwoord.');
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

  // Fetch team memberships
  const { data: teams } = await supabase
    .from('player_teams')
    .select('team_id, is_team_captain')
    .eq('player_id', player.id);

  return {
    ...player,
    team_ids: teams?.map((t: { team_id: string }) => t.team_id) || [],
    captain_team_ids:
      teams
        ?.filter((t: { team_id: string; is_team_captain?: boolean }) => !!t.is_team_captain)
        .map((t: { team_id: string }) => t.team_id) || [],
  };
}

export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getPlayersForTeam(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('player_teams')
    .select('player_id')
    .eq('team_id', teamId);

  if (error) throw error;
  const playerIds = data?.map((r: { player_id: number }) => r.player_id) || [];
  if (playerIds.length === 0) return [];

  const { data: players, error: pError } = await supabase
    .from('players')
    .select('*')
    .in('id', playerIds)
    .order('name');

  if (pError) throw pError;
  return players || [];
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

export async function resetForgottenPassword(username: string, newPassword: string): Promise<void> {
  const email = usernameToEmail(username);

  // Validate that username exists and still has default password
  const { data: player, error: lookupError } = await supabase
    .from('players')
    .select('must_change_password')
    .eq('username', username.toLowerCase().trim())
    .maybeSingle();

  if (lookupError || !player) {
    throw new Error('Wachtwoord resetten is niet mogelijk. Neem contact op met een beheerder.');
  }

  // Only allow reset if user still has the default password (must_change_password = true)
  if (!player.must_change_password) {
    throw new Error('Wachtwoord resetten is niet mogelijk. Neem contact op met een beheerder.');
  }

  if (!DEFAULT_PASSWORD) {
    throw new Error('Wachtwoord resetten is niet beschikbaar. Neem contact op met een beheerder.');
  }

  // Try to sign in with the default password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: DEFAULT_PASSWORD,
  });

  if (signInError) {
    throw new Error(
      'Wachtwoord resetten is niet mogelijk. Neem contact op met een beheerder.'
    );
  }

  // Update to the new password
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    await supabase.auth.signOut();
    throw new Error('Wachtwoord wijzigen mislukt: ' + updateError.message);
  }

  // Mark password as changed
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('players')
      .update({ must_change_password: false })
      .eq('auth_user_id', user.id);
  }

  await supabase.auth.signOut();
}
