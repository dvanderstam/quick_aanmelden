const { createClient } = require('@supabase/supabase-js');

const TEAM_ID_REGEX = /^[a-z0-9-]{2,20}$/;

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

function normalizeTeamId(value) {
  return String(value || '').trim().toLowerCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json(500, { error: 'Missing server environment variables.' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const accessToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!accessToken) {
    return json(401, { error: 'Missing access token.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  const teamId = normalizeTeamId(payload.teamId);
  const name = String(payload.name || '').trim();
  const shortName = String(payload.shortName || '').trim();
  const icsUrl = String(payload.icsUrl || '').trim();
  const enableReplacementFlow = !!payload.enableReplacementFlow;
  const enableReplacementNameEntry = !!payload.enableReplacementNameEntry;
  const active = payload.active !== false;

  if (!teamId || !name || !shortName) {
    return json(400, { error: 'teamId, naam en shortName zijn verplicht.' });
  }

  if (!TEAM_ID_REGEX.test(teamId)) {
    return json(400, { error: 'teamId moet 2-20 tekens zijn: a-z, 0-9 en streepje.' });
  }

  if (icsUrl && !/^https?:\/\//i.test(icsUrl)) {
    return json(400, { error: 'ICS URL moet met http:// of https:// beginnen.' });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData?.user?.id) {
    return json(401, { error: 'Ongeldige sessie.' });
  }

  const { data: actor, error: actorError } = await adminClient
    .from('players')
    .select('id, role')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (actorError) {
    return json(500, { error: `Kon gebruikerscontext niet laden: ${actorError.message}` });
  }

  if (!actor || actor.role !== 'admin') {
    return json(403, { error: 'Alleen admins mogen teams aanmaken.' });
  }

  const { data: existing, error: existingError } = await adminClient
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .maybeSingle();

  if (existingError && /teams|relation|does not exist|schema cache/i.test(existingError.message || '')) {
    return json(400, { error: 'Database mist teams tabel. Draai migration_v18_teams_table.sql eerst.' });
  }

  if (existingError) {
    return json(500, { error: `Kon bestaande teams niet controleren: ${existingError.message}` });
  }

  if (existing) {
    return json(409, { error: `Team met id ${teamId} bestaat al.` });
  }

  const { data: inserted, error: insertError } = await adminClient
    .from('teams')
    .insert({
      id: teamId,
      name,
      short_name: shortName,
      ics_url: icsUrl,
      enable_replacement_flow: enableReplacementFlow,
      enable_replacement_name_entry: enableReplacementNameEntry,
      active,
    })
    .select('id, name, short_name, ics_url, enable_replacement_flow, enable_replacement_name_entry, active')
    .single();

  if (insertError) {
    return json(500, { error: `Team aanmaken mislukt: ${insertError.message}` });
  }

  return json(200, {
    team: {
      id: inserted.id,
      name: inserted.name,
      shortName: inserted.short_name,
      icsUrl: inserted.ics_url || '',
      enableReplacementFlow: inserted.enable_replacement_flow === true,
      enableReplacementNameEntry: inserted.enable_replacement_name_entry === true,
      active: inserted.active !== false,
    },
  });
};
