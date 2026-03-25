import { supabase } from './supabase';
import { Player } from './types';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, playerId: number) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  if (data.user) {
    const { data: updated, error: claimError } = await supabase
      .from('players')
      .update({ auth_user_id: data.user.id })
      .eq('id', playerId)
      .is('auth_user_id', null)
      .select();

    if (claimError || !updated || updated.length === 0) {
      await supabase.auth.signOut();
      throw new Error('Deze speler is al door iemand anders geclaimd.');
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

export async function getUnclaimedPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .is('auth_user_id', null)
    .order('name');

  if (error) throw error;
  return data || [];
}

export function canEditPlayer(currentPlayer: Player, targetPlayerId: number): boolean {
  if (currentPlayer.role === 'admin') return true;
  return currentPlayer.id === targetPlayerId;
}
