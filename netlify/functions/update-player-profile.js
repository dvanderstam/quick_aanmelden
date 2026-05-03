const { createClient } = require('@supabase/supabase-js');

const EMAIL_DOMAIN = 'quick.local';
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

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

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function toEmail(username) {
  return `${username}@${EMAIL_DOMAIN}`;
}

async function getActor(adminClient, authUserId) {
  const { data, error } = await adminClient
    .from('players')
    .select('id, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon actor niet laden: ${error.message}`);
  }

  return data;
}

async function getManageableTeamIds(adminClient, actor) {
  if (actor.role === 'admin') return null;

  const { data, error } = await adminClient
    .from('player_teams')
    .select('team_id, is_team_captain')
    .eq('player_id', actor.id);

  if (error) {
    throw new Error(`Kon actor teams niet laden: ${error.message}`);
  }

  return new Set(
    (data || [])
      .filter((row) => actor.role === 'teamAdmin' || !!row.is_team_captain)
      .map((row) => row.team_id)
  );
}

async function targetInManagedTeam(adminClient, playerId, manageableTeamIds) {
  const { data, error } = await adminClient
    .from('player_teams')
    .select('team_id')
    .eq('player_id', playerId);

  if (error) {
    throw new Error(`Kon spelerteams niet laden: ${error.message}`);
  }

  return (data || []).some((row) => manageableTeamIds.has(row.team_id));
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Geen autorisatie.' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: 'Server configuratie ontbreekt.' });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData?.user) {
    return json(401, { error: 'Ongeldige sessie.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldig verzoek.' });
  }

  const playerId = Number(body.playerId);
  const name = normalizeName(body.name);
  const username = normalizeUsername(body.username);

  if (!Number.isInteger(playerId)) {
    return json(400, { error: 'playerId moet een integer zijn.' });
  }
  if (!name) {
    return json(400, { error: 'Naam is verplicht.' });
  }
  if (!username) {
    return json(400, { error: 'Gebruikersnaam is verplicht.' });
  }
  if (!USERNAME_REGEX.test(username)) {
    return json(400, {
      error: 'Gebruikersnaam mag alleen kleine letters, cijfers, punt, streepje en underscore bevatten.',
    });
  }

  try {
    const actor = await getActor(adminClient, authData.user.id);
    if (!actor) {
      return json(403, { error: 'Geen gekoppeld spelersprofiel gevonden.' });
    }

    const { data: targetPlayer, error: targetError } = await adminClient
      .from('players')
      .select('id, name, username, auth_user_id')
      .eq('id', playerId)
      .maybeSingle();

    if (targetError) {
      return json(500, { error: `Kon doelspeler niet laden: ${targetError.message}` });
    }
    if (!targetPlayer) {
      return json(404, { error: 'Speler niet gevonden.' });
    }

    if (actor.role !== 'admin') {
      const manageableTeamIds = await getManageableTeamIds(adminClient, actor);
      if (!manageableTeamIds || manageableTeamIds.size === 0) {
        return json(403, { error: 'Je beheert geen teams.' });
      }

      const hasAccess = await targetInManagedTeam(adminClient, playerId, manageableTeamIds);
      if (!hasAccess) {
        return json(403, { error: 'Je mag alleen spelers uit je eigen team(s) bewerken.' });
      }
    }

    const { data: conflictPlayer, error: conflictError } = await adminClient
      .from('players')
      .select('id, username')
      .ilike('username', username)
      .neq('id', playerId)
      .maybeSingle();

    if (conflictError) {
      return json(500, { error: `Kon gebruikersnaam niet controleren: ${conflictError.message}` });
    }
    if (conflictPlayer) {
      return json(409, { error: 'Deze gebruikersnaam is al in gebruik.' });
    }

    const previous = {
      name: targetPlayer.name,
      username: targetPlayer.username,
    };

    const { error: updateError } = await adminClient
      .from('players')
      .update({ name, username })
      .eq('id', playerId);

    if (updateError) {
      if ((updateError.message || '').toLowerCase().includes('duplicate')) {
        return json(409, { error: 'Deze gebruikersnaam is al in gebruik.' });
      }
      return json(500, { error: `Speler bijwerken mislukt: ${updateError.message}` });
    }

    const usernameChanged = previous.username !== username;
    if (usernameChanged && targetPlayer.auth_user_id) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        targetPlayer.auth_user_id,
        {
          email: toEmail(username),
          email_confirm: true,
        }
      );

      if (authUpdateError) {
        const { error: rollbackError } = await adminClient
          .from('players')
          .update(previous)
          .eq('id', playerId);

        if (rollbackError) {
          return json(500, {
            error: `Auth e-mail bijwerken mislukt (${authUpdateError.message}) en rollback van spelergegevens is ook mislukt (${rollbackError.message}).`,
          });
        }

        return json(500, {
          error: `Auth e-mail bijwerken mislukt: ${authUpdateError.message}. Wijziging is teruggedraaid.`,
        });
      }
    }

    return json(200, {
      success: true,
      player: {
        id: playerId,
        name,
        username,
      },
    });
  } catch (error) {
    return json(500, { error: error.message || 'Onverwachte serverfout.' });
  }
};
