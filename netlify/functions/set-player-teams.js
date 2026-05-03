const { createClient } = require('@supabase/supabase-js');

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

function normalizeTeamIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v || '').trim()).filter(Boolean))];
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Geen autorisatie.' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Server configuratie ontbreekt.' });

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Ongeldige sessie.' });

  const { data: actor } = await adminClient
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!actor) {
    return json(403, { error: 'Geen gekoppeld spelersprofiel gevonden.' });
  }

  const isAdmin = actor.role === 'admin';

  let actorCaptainTeamIds = [];
  if (!isAdmin) {
    const { data: actorCaptainTeams, error: actorCaptainError } = await adminClient
      .from('player_teams')
      .select('team_id')
      .eq('player_id', actor.id)
      .eq('is_team_captain', true);

    if (actorCaptainError) {
      return json(500, { error: `Kon captainteams niet laden: ${actorCaptainError.message}` });
    }

    actorCaptainTeamIds = normalizeTeamIds((actorCaptainTeams || []).map((row) => row.team_id));
    if (actorCaptainTeamIds.length === 0) {
      return json(403, { error: 'Alleen admins of teamcaptains mogen dit uitvoeren.' });
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldig verzoek.' });
  }

  const playerId = Number(body.playerId);
  const requestedTeamIds = normalizeTeamIds(body.teamIds);
  const requestedCaptainIdsRaw = normalizeTeamIds(body.captainTeamIds);
  const requestedTeamSet = new Set(requestedTeamIds);
  const requestedCaptainIds = requestedCaptainIdsRaw.filter((teamId) => requestedTeamSet.has(teamId));

  if (!Number.isInteger(playerId)) {
    return json(400, { error: 'playerId moet een integer zijn.' });
  }

  const { data: existing, error: existingError } = await adminClient
    .from('player_teams')
    .select('team_id, is_team_captain')
    .eq('player_id', playerId);

  if (existingError) {
    return json(500, { error: `Kon bestaande teams niet laden: ${existingError.message}` });
  }

  const existingRows = existing || [];
  const existingTeamIds = new Set(existingRows.map((row) => row.team_id));

  if (!isAdmin) {
    if (playerId === actor.id) {
      return json(403, { error: 'Je kunt je eigen captainrechten niet wijzigen.' });
    }

    const managedSet = new Set(actorCaptainTeamIds);
    const manageableTargetTeamIds = [...existingTeamIds].filter((teamId) => managedSet.has(teamId));
    if (manageableTargetTeamIds.length === 0) {
      return json(403, { error: 'Je mag alleen captainrechten aanpassen binnen je eigen team(s).' });
    }

    const requestedCaptainSet = new Set(
      requestedCaptainIdsRaw.filter((teamId) => managedSet.has(teamId) && existingTeamIds.has(teamId))
    );

    const rows = existingRows.map((row) => ({
      player_id: playerId,
      team_id: row.team_id,
      is_team_captain: managedSet.has(row.team_id)
        ? requestedCaptainSet.has(row.team_id)
        : !!row.is_team_captain,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await adminClient
        .from('player_teams')
        .upsert(rows, { onConflict: 'player_id,team_id' });

      if (upsertError) {
        return json(500, { error: `Opslaan van captainrechten mislukt: ${upsertError.message}` });
      }
    }

    const captainTeamIds = rows
      .filter((row) => row.is_team_captain)
      .map((row) => row.team_id);

    return json(200, {
      success: true,
      teamIds: [...existingTeamIds],
      captainTeamIds,
    });
  }

  const requestedSet = new Set(requestedTeamIds);
  const toDelete = [...existingTeamIds].filter((teamId) => !requestedSet.has(teamId));

  if (toDelete.length > 0) {
    const { error: deleteError } = await adminClient
      .from('player_teams')
      .delete()
      .eq('player_id', playerId)
      .in('team_id', toDelete);

    if (deleteError) {
      return json(500, { error: `Verwijderen van teams mislukt: ${deleteError.message}` });
    }
  }

  const rows = requestedTeamIds.map((teamId) => ({
    player_id: playerId,
    team_id: teamId,
    is_team_captain: requestedCaptainIds.includes(teamId),
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await adminClient
      .from('player_teams')
      .upsert(rows, { onConflict: 'player_id,team_id' });

    if (upsertError) {
      return json(500, { error: `Opslaan van teams mislukt: ${upsertError.message}` });
    }
  }

  return json(200, { success: true, teamIds: requestedTeamIds, captainTeamIds: requestedCaptainIds });
};
