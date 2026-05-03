const { createClient } = require('@supabase/supabase-js');

const EMAIL_DOMAIN = 'quick.local';

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

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function slugifyPart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

function suggestUsername(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .map(slugifyPart)
    .filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  return `${parts[0]}.${parts.slice(1).join('')}`;
}

function buildCandidateUsernames(name) {
  const base = suggestUsername(name);
  if (!base) return [];

  return [base, `${base}2`, `${base}3`, `${base}4`, `${base}5`];
}

function toEmail(username) {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function getActorContext(adminClient, authUserId) {
  const { data: actor, error: actorError } = await adminClient
    .from('players')
    .select('id, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (actorError) throw new Error(`Could not load actor: ${actorError.message}`);
  if (!actor) return null;

  const { data: memberships, error: membershipsError } = await adminClient
    .from('player_teams')
    .select('team_id, is_team_captain')
    .eq('player_id', actor.id);

  if (membershipsError) throw new Error(`Could not load actor teams: ${membershipsError.message}`);

  return {
    ...actor,
    teamIds: (memberships || []).map((membership) => membership.team_id),
    captainTeamIds: (memberships || [])
      .filter((membership) => !!membership.is_team_captain)
      .map((membership) => membership.team_id),
  };
}

async function createAuthUser(adminClient, username, defaultPassword) {
  const email = toEmail(username);
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Could not create auth user for ${username}: ${error.message}`);
  }

  if (!data?.user?.id) {
    throw new Error(`Missing auth user id for ${username}`);
  }

  return data.user.id;
}

async function getNextPlayerId(adminClient) {
  const { data, error } = await adminClient
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not determine next player id: ${error.message}`);
  }

  return (data?.id || 0) + 1;
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
  const defaultPassword = process.env.EXPO_PUBLIC_DEFAULT_PASSWORD || process.env.DEFAULT_PASSWORD;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !defaultPassword) {
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

  const teamId = String(payload.teamId || '').trim();
  const name = String(payload.name || '').trim();
  const requestedUsername = normalizeUsername(payload.username);

  if (!teamId || !name) {
    return json(400, { error: 'Naam en team zijn verplicht.' });
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

  try {
    const actor = await getActorContext(adminClient, authData.user.id);
    if (!actor) {
      return json(403, { error: 'Geen gekoppelde speler gevonden voor deze sessie.' });
    }

    const canManageRequestedTeam = actor.role === 'admin'
      || (actor.role === 'teamAdmin' && actor.teamIds.includes(teamId))
      || actor.captainTeamIds.includes(teamId);

    if (!canManageRequestedTeam) {
      return json(403, { error: 'Je mag geen spelers toevoegen aan dit team.' });
    }

    const candidates = Array.from(new Set([
      ...(requestedUsername ? [requestedUsername] : []),
      ...buildCandidateUsernames(name),
    ]));

    if (candidates.length === 0) {
      return json(400, { error: 'Kon geen gebruikersnaam voorstellen op basis van de naam.' });
    }

    const { data: existingPlayers, error: existingPlayersError } = await adminClient
      .from('players')
      .select('id, name, username, auth_user_id')
      .in('username', candidates);

    if (existingPlayersError) {
      throw new Error(`Could not load players: ${existingPlayersError.message}`);
    }

    let targetPlayer = null;
    let username = '';
    let createdPlayer = false;
    const normalizedRequestedName = normalizeName(name);

    for (const candidate of candidates) {
      const existing = (existingPlayers || []).find((player) => player.username === candidate);
      if (existing && normalizeName(existing.name) === normalizedRequestedName) {
        targetPlayer = existing;
        username = candidate;
        break;
      }
      if (!existing && !username) {
        username = candidate;
      }
    }

    if (!targetPlayer) {
      if (!username) {
        return json(409, {
          error: 'Kon geen vrije gebruikersnaam vinden. Kies een ander voorstel.',
        });
      }

      const authUserId = await createAuthUser(adminClient, username, defaultPassword);
      const playerId = await getNextPlayerId(adminClient);
      const { data: insertedPlayer, error: insertPlayerError } = await adminClient
        .from('players')
        .insert({
          id: playerId,
          name,
          role: 'speler',
          username,
          auth_user_id: authUserId,
          must_change_password: true,
          disclaimer_accepted: false,
        })
        .select('id, name, username, auth_user_id')
        .single();

      if (insertPlayerError) {
        await adminClient.auth.admin.deleteUser(authUserId);
        throw new Error(`Could not create player: ${insertPlayerError.message}`);
      }

      targetPlayer = insertedPlayer;
      createdPlayer = true;
    }

    const { data: existingMembership, error: existingMembershipError } = await adminClient
      .from('player_teams')
      .select('player_id')
      .eq('player_id', targetPlayer.id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (existingMembershipError) {
      throw new Error(`Could not load team membership: ${existingMembershipError.message}`);
    }

    if (!existingMembership) {
      const { error: membershipInsertError } = await adminClient
        .from('player_teams')
        .insert({ player_id: targetPlayer.id, team_id: teamId });

      if (membershipInsertError) {
        throw new Error(`Could not link player to team: ${membershipInsertError.message}`);
      }
    }

    const nameMismatch = targetPlayer.name !== name;
    const result = createdPlayer
      ? 'created'
      : existingMembership
        ? 'already-linked'
        : 'linked';

    return json(200, {
      result,
      player: {
        id: targetPlayer.id,
        name: targetPlayer.name,
        username: targetPlayer.username,
        authUserCreated: createdPlayer,
      },
      nameMismatch,
      mustChangePassword: createdPlayer,
    });
  } catch (error) {
    return json(500, { error: error.message || 'Unexpected server error.' });
  }
};