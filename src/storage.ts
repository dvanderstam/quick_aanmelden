import { Platform } from 'react-native';
import { supabase } from './supabase';
import { AttendanceStatus } from './types';

function getFunctionUrl(path: string): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  if (Platform.OS !== 'web') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL ontbreekt voor deze omgeving.');
  }

  return path;
}

export async function getAttendance(
  gameId: string,
  playerId: number
): Promise<AttendanceStatus> {
  const { data } = await supabase
    .from('attendance')
    .select('status')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .maybeSingle();

  return (data?.status as AttendanceStatus) || null;
}

export async function setAttendance(
  gameId: string,
  playerId: number,
  status: AttendanceStatus,
  needsReplacement?: boolean
): Promise<void> {
  if (status === null) {
    await supabase
      .from('attendance')
      .delete()
      .eq('game_id', gameId)
      .eq('player_id', playerId);
  } else {
    // Als status 'present' is en needsReplacement niet true, clear is_substitute
    const update: any = {
      game_id: gameId,
      player_id: playerId,
      status,
      updated_at: new Date().toISOString(),
      replacement_name: null,
      replacement_set_by_player_id: null,
      replacement_set_at: null,
      ...(needsReplacement !== undefined && { needs_replacement: needsReplacement }),
    };
    if (status !== 'present' || needsReplacement !== true) {
      update.is_substitute = false;
    }
    await supabase.from('attendance').upsert(
      update,
      { onConflict: 'game_id,player_id' }
    );
  }
}

export async function setNeedsReplacement(
  gameId: string,
  playerId: number,
  value: boolean
): Promise<void> {
  await supabase
    .from('attendance')
    .update({ needs_replacement: value })
    .eq('game_id', gameId)
    .eq('player_id', playerId);
}

export async function markSubstitute(
  gameId: string,
  playerId: number,
): Promise<void> {
  await supabase
    .from('attendance')
    .update({
      status: 'present',
      needs_replacement: false,
      is_substitute: true,
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)
    .eq('player_id', playerId);
}

export async function getAllAttendanceForGame(
  gameId: string,
  playerIds: number[]
): Promise<{
  statuses: Record<number, AttendanceStatus>;
  timestamps: Record<number, string | null>;
  replacements: Record<number, boolean>;
  substitutes: Record<number, boolean>;
  replacementNames: Record<number, string | null>;
}> {
  const { data } = await supabase
    .from('attendance')
    .select('player_id, status, updated_at, needs_replacement, is_substitute, replacement_name')
    .eq('game_id', gameId)
    .in('player_id', playerIds);

  const statuses: Record<number, AttendanceStatus> = {};
  const timestamps: Record<number, string | null> = {};
  const replacements: Record<number, boolean> = {};
  const substitutes: Record<number, boolean> = {};
  const replacementNames: Record<number, string | null> = {};
  for (const pid of playerIds) {
    statuses[pid] = null;
    timestamps[pid] = null;
    replacements[pid] = false;
    substitutes[pid] = false;
    replacementNames[pid] = null;
  }
  if (data) {
    for (const row of data) {
      statuses[row.player_id] = row.status as AttendanceStatus;
      timestamps[row.player_id] = row.updated_at ?? null;
      replacements[row.player_id] = row.needs_replacement ?? false;
      substitutes[row.player_id] = row.is_substitute ?? false;
      replacementNames[row.player_id] = row.replacement_name ?? null;
    }
  }
  return { statuses, timestamps, replacements, substitutes, replacementNames };
}

export async function setPlayerReplacementName(
  gameId: string,
  teamId: string,
  playerId: number,
  replacementName: string | null
): Promise<{ status: AttendanceStatus; updatedAt: string | null; replacementName: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/set-player-replacement'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      gameId,
      teamId,
      playerId,
      replacementName,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Vervanger opslaan mislukt.');
  }

  return {
    status: (payload?.attendance?.status as AttendanceStatus) || null,
    updatedAt: payload?.attendance?.updatedAt || null,
    replacementName: payload?.attendance?.replacementName || null,
  };
}

export async function getAttendanceSummary(
  gameId: string,
  playerIds: number[]
): Promise<{ present: number; absent: number; uncertain: number; noResponse: number }> {
  const { statuses: all } = await getAllAttendanceForGame(gameId, playerIds);
  let present = 0;
  let absent = 0;
  let uncertain = 0;
  let noResponse = 0;

  for (const pid of playerIds) {
    const s = all[pid];
    if (s === 'present') present++;
    else if (s === 'absent') absent++;
    else if (s === 'uncertain') uncertain++;
    else noResponse++;
  }

  return { present, absent, uncertain, noResponse };
}
