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
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Server configuratie ontbreekt.' });

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Ongeldige sessie.' });

  const { data: actor, error: actorError } = await adminClient
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (actorError) return json(500, { error: 'Kon spelerprofiel niet laden.' });
  if (!actor) return json(403, { error: 'Geen spelerprofiel gevonden.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldig verzoek.' });
  }

  const { playerId, teamId } = body;

  if (!playerId || !teamId) return json(400, { error: 'playerId en teamId zijn verplicht.' });
  if (typeof playerId !== 'number' || typeof teamId !== 'string') {
    return json(400, { error: 'Ongeldig type voor playerId of teamId.' });
  }

  if (actor.role !== 'admin') {
    const { data: membership, error: membershipError } = await adminClient
      .from('player_teams')
      .select('team_id, is_team_captain')
      .eq('player_id', actor.id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (membershipError) {
      return json(500, { error: 'Kon teamrechten niet controleren.' });
    }

    const isTeamAdminForTeam = actor.role === 'teamAdmin' && !!membership;
    const isCaptainForTeam = !!membership?.is_team_captain;

    if (!isTeamAdminForTeam && !isCaptainForTeam) {
      return json(403, { error: 'Je beheert dit team niet.' });
    }
  }

  // Voorkom dat iemand zichzelf uit het team verwijdert
  if (actor.id === playerId) {
    return json(400, { error: 'Je kunt jezelf niet uit het team verwijderen.' });
  }

  const { error: deleteError } = await adminClient
    .from('player_teams')
    .delete()
    .eq('player_id', playerId)
    .eq('team_id', teamId);

  if (deleteError) {
    return json(500, { error: `Kon speler niet verwijderen: ${deleteError.message}` });
  }

  return json(200, { success: true });
};
