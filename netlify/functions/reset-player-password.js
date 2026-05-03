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

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Geen autorisatie.' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultPassword = process.env.EXPO_PUBLIC_DEFAULT_PASSWORD;
  if (!supabaseUrl || !serviceKey || !defaultPassword) {
    return json(500, { error: 'Server configuratie ontbreekt.' });
  }

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

  if (!actor) return json(403, { error: 'Geen spelerprofiel gevonden.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldig verzoek.' });
  }

  const { playerId } = body;
  if (typeof playerId !== 'number') {
    return json(400, { error: 'playerId (number) is verplicht.' });
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, auth_user_id, username')
    .eq('id', playerId)
    .maybeSingle();

  if (playerError) return json(500, { error: `Speler ophalen mislukt: ${playerError.message}` });
  if (!player) return json(404, { error: 'Speler niet gevonden.' });

  if (!player.auth_user_id) {
    return json(400, { error: 'Speler heeft nog geen account aangemaakt.' });
  }

  if (actor.role !== 'admin') {
    const { data: actorMemberships, error: actorMembershipsError } = await adminClient
      .from('player_teams')
      .select('team_id, is_team_captain')
      .eq('player_id', actor.id);

    if (actorMembershipsError) {
      return json(500, { error: `Kon actor teams niet laden: ${actorMembershipsError.message}` });
    }

    const manageableTeamIds = new Set(
      (actorMemberships || [])
        .filter((row) => actor.role === 'teamAdmin' || !!row.is_team_captain)
        .map((row) => row.team_id)
    );

    if (manageableTeamIds.size === 0) {
      return json(403, { error: 'Je beheert geen teams.' });
    }

    const { data: targetMemberships, error: targetMembershipsError } = await adminClient
      .from('player_teams')
      .select('team_id')
      .eq('player_id', playerId);

    if (targetMembershipsError) {
      return json(500, { error: `Kon speler teams niet laden: ${targetMembershipsError.message}` });
    }

    const isInManagedTeam = (targetMemberships || []).some((row) => manageableTeamIds.has(row.team_id));
    if (!isInManagedTeam) {
      return json(403, { error: 'Je mag alleen spelers uit je eigen team(s) beheren.' });
    }
  }

  const { error: pwError } = await adminClient.auth.admin.updateUserById(player.auth_user_id, {
    password: defaultPassword,
  });

  if (pwError) return json(500, { error: `Wachtwoord resetten mislukt: ${pwError.message}` });

  await adminClient
    .from('players')
    .update({ must_change_password: true })
    .eq('id', playerId);

  return json(200, { success: true, username: player.username });
};
