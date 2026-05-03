const { createClient } = require('@supabase/supabase-js');

const EMAIL_DOMAIN = 'quick.local';
const MAX_LINES = 300;

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

function buildCandidateUsernames(name, max = 40) {
  const base = suggestUsername(name);
  if (!base) return [];

  const candidates = [];
  for (let i = 1; i <= max; i += 1) {
    candidates.push(i === 1 ? base : `${base}${i}`);
  }
  return candidates;
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toEmail(username) {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
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

function parseNames(text) {
  const rows = String(text || '').split(/\r?\n/);
  const parsed = [];

  for (let i = 0; i < rows.length; i += 1) {
    const lineNumber = i + 1;
    const raw = rows[i].trim();
    if (!raw) continue;

    const name = raw.includes(':')
      ? raw.slice(0, raw.indexOf(':')).trim().replace(/\s+/g, ' ')
      : raw.replace(/\s+/g, ' ');

    if (!name) {
      parsed.push({ lineNumber, name: '', error: 'Geen geldige naam gevonden op regel.' });
      continue;
    }

    parsed.push({ lineNumber, name });
  }

  return parsed;
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
  const namesText = String(payload.namesText || '');

  if (!teamId) {
    return json(400, { error: 'teamId is verplicht.' });
  }

  if (!namesText.trim()) {
    return json(400, { error: 'Plak eerst minimaal 1 naam.' });
  }

  const parsedRows = parseNames(namesText);
  if (parsedRows.length === 0) {
    return json(400, { error: 'Geen verwerkbare namen gevonden.' });
  }

  if (parsedRows.length > MAX_LINES) {
    return json(400, { error: `Maximaal ${MAX_LINES} namen per import.` });
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

    const { data: teamExists, error: teamCheckError } = await adminClient
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .maybeSingle();

    if (teamCheckError && /teams|relation|does not exist|schema cache/i.test(teamCheckError.message || '')) {
      return json(400, { error: 'Database mist teams tabel. Draai migration_v18_teams_table.sql eerst.' });
    }

    if (teamCheckError) {
      throw new Error(`Could not verify team: ${teamCheckError.message}`);
    }

    if (!teamExists) {
      return json(400, { error: `Onbekend team: ${teamId}.` });
    }

    let nextPlayerId = await getNextPlayerId(adminClient);

    const results = [];
    for (const row of parsedRows) {
      if (row.error) {
        results.push({
          lineNumber: row.lineNumber,
          name: row.name,
          username: null,
          status: 'error',
          error: row.error,
        });
        continue;
      }

      const candidates = buildCandidateUsernames(row.name);
      if (candidates.length === 0) {
        results.push({
          lineNumber: row.lineNumber,
          name: row.name,
          username: null,
          status: 'error',
          error: 'Kon geen gebruikersnaam voorstellen op basis van deze naam.',
        });
        continue;
      }

      try {
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
        const normalizedRequestedName = normalizeName(row.name);

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
            throw new Error('Kon geen vrije gebruikersnaam vinden.');
          }

          const authUserId = await createAuthUser(adminClient, username, defaultPassword);
          const playerId = nextPlayerId;
          nextPlayerId += 1;

          const { data: insertedPlayer, error: insertPlayerError } = await adminClient
            .from('players')
            .insert({
              id: playerId,
              name: row.name,
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

        const status = createdPlayer
          ? 'created'
          : existingMembership
            ? 'already-linked'
            : 'linked';

        results.push({
          lineNumber: row.lineNumber,
          name: row.name,
          username: targetPlayer.username,
          status,
          error: null,
        });
      } catch (lineError) {
        results.push({
          lineNumber: row.lineNumber,
          name: row.name,
          username: null,
          status: 'error',
          error: lineError.message || 'Onbekende fout tijdens verwerken van regel.',
        });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      linked: results.filter((r) => r.status === 'linked').length,
      alreadyLinked: results.filter((r) => r.status === 'already-linked').length,
      errors: results.filter((r) => r.status === 'error').length,
    };

    return json(200, { summary, results });
  } catch (error) {
    return json(500, { error: error.message || 'Unexpected server error.' });
  }
};
