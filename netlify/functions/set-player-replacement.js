const { createClient } = require('@supabase/supabase-js');

const MAX_REPLACEMENT_NAME_LENGTH = 80;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function normalizeReplacementName(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Geen autorisatie.' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: 'Server configuratie ontbreekt.' });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData?.user) return json(401, { error: 'Ongeldige sessie.' });

  const { data: actor, error: actorError } = await adminClient
    .from('players')
    .select('id, role')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (actorError) {
    return json(500, { error: `Kon gebruikerscontext niet laden: ${actorError.message}` });
  }

  if (!actor) {
    return json(403, { error: 'Geen gekoppeld spelersprofiel gevonden.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldig verzoek.' });
  }

  const gameId = String(body.gameId || '').trim();
  const teamId = String(body.teamId || '').trim();
  const playerId = Number(body.playerId);
  const replacementName = normalizeReplacementName(body.replacementName);

  if (!gameId || !teamId || !Number.isInteger(playerId)) {
    return json(400, { error: 'gameId, teamId en playerId zijn verplicht.' });
  }

  if (replacementName && replacementName.length > MAX_REPLACEMENT_NAME_LENGTH) {
    return json(400, { error: `Vervangernaam mag maximaal ${MAX_REPLACEMENT_NAME_LENGTH} tekens bevatten.` });
  }

  const isAdmin = actor.role === 'admin';

  if (!isAdmin) {
    const { data: captainMembership, error: captainError } = await adminClient
      .from('player_teams')
      .select('team_id')
      .eq('player_id', actor.id)
      .eq('team_id', teamId)
      .eq('is_team_captain', true)
      .maybeSingle();

    if (captainError) {
      return json(500, { error: `Kon captainrechten niet controleren: ${captainError.message}` });
    }

    if (!captainMembership) {
      return json(403, { error: 'Alleen admins of teamcaptains van dit team mogen dit uitvoeren.' });
    }
  }

  const { data: targetMembership, error: targetMembershipError } = await adminClient
    .from('player_teams')
    .select('player_id')
    .eq('player_id', playerId)
    .eq('team_id', teamId)
    .maybeSingle();

  if (targetMembershipError) {
    return json(500, { error: `Kon teamlidmaatschap niet controleren: ${targetMembershipError.message}` });
  }

  if (!targetMembership) {
    return json(403, { error: 'Doelspeler hoort niet bij dit team.' });
  }

  const now = new Date().toISOString();
  const updatePayload = {
    game_id: gameId,
    player_id: playerId,
    status: replacementName ? 'present' : 'absent',
    replacement_name: replacementName,
    replacement_set_by_player_id: actor.id,
    replacement_set_at: now,
    updated_at: now,
    is_substitute: false,
    ...(replacementName && { needs_replacement: false }),
  };

  const { data: updatedAttendance, error: updateError } = await adminClient
    .from('attendance')
    .upsert(updatePayload, { onConflict: 'game_id,player_id' })
    .select('player_id, status, updated_at, replacement_name')
    .single();

  if (updateError) {
    return json(500, { error: `Vervanger opslaan mislukt: ${updateError.message}` });
  }

  return json(200, {
    success: true,
    attendance: {
      playerId: updatedAttendance.player_id,
      status: updatedAttendance.status,
      updatedAt: updatedAttendance.updated_at,
      replacementName: updatedAttendance.replacement_name || null,
    },
  });
};
