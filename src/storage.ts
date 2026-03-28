import { supabase } from './supabase';
import { AttendanceStatus } from './types';

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
    await supabase.from('attendance').upsert(
      {
        game_id: gameId,
        player_id: playerId,
        status,
        updated_at: new Date().toISOString(),
        ...(needsReplacement !== undefined && { needs_replacement: needsReplacement }),
      },
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

export async function getAllAttendanceForGame(
  gameId: string,
  playerIds: number[]
): Promise<{ statuses: Record<number, AttendanceStatus>; timestamps: Record<number, string | null>; replacements: Record<number, boolean> }> {
  const { data } = await supabase
    .from('attendance')
    .select('player_id, status, updated_at, needs_replacement')
    .eq('game_id', gameId)
    .in('player_id', playerIds);

  const statuses: Record<number, AttendanceStatus> = {};
  const timestamps: Record<number, string | null> = {};
  const replacements: Record<number, boolean> = {};
  for (const pid of playerIds) {
    statuses[pid] = null;
    timestamps[pid] = null;
    replacements[pid] = false;
  }
  if (data) {
    for (const row of data) {
      statuses[row.player_id] = row.status as AttendanceStatus;
      timestamps[row.player_id] = row.updated_at ?? null;
      replacements[row.player_id] = row.needs_replacement ?? false;
    }
  }
  return { statuses, timestamps, replacements };
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
