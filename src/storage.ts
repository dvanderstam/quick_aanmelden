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
  status: AttendanceStatus
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
      },
      { onConflict: 'game_id,player_id' }
    );
  }
}

export async function getAllAttendanceForGame(
  gameId: string,
  playerIds: number[]
): Promise<Record<number, AttendanceStatus>> {
  const { data } = await supabase
    .from('attendance')
    .select('player_id, status')
    .eq('game_id', gameId)
    .in('player_id', playerIds);

  const result: Record<number, AttendanceStatus> = {};
  for (const pid of playerIds) {
    result[pid] = null;
  }
  if (data) {
    for (const row of data) {
      result[row.player_id] = row.status as AttendanceStatus;
    }
  }
  return result;
}

export async function getAttendanceSummary(
  gameId: string,
  playerIds: number[]
): Promise<{ present: number; absent: number; uncertain: number; noResponse: number }> {
  const all = await getAllAttendanceForGame(gameId, playerIds);
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
