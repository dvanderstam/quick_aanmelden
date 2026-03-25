import { supabase } from './supabase';
import { Player } from './types';

const EMAIL_DOMAIN = 'quick.local';

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
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

  return player || null;
}

export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export function canEditPlayer(currentPlayer: Player, targetPlayerId: number): boolean {
  if (currentPlayer.role === 'admin') return true;
  return currentPlayer.id === targetPlayerId;
}

export async function changePassword(newPassword: string): Promise<void> {
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
