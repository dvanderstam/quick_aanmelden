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

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Wachtwoord moet minimaal 8 tekens zijn.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Wachtwoord moet minimaal 1 hoofdletter bevatten.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Wachtwoord moet minimaal 1 cijfer bevatten.';
  }
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: 'Server configuratie ontbreekt.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldig verzoek.' });
  }

  const username = String(body.username || '').trim().toLowerCase();
  const newPassword = String(body.newPassword || '');

  if (!username) {
    return json(400, { error: 'Gebruikersnaam is verplicht.' });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return json(400, { error: passwordError });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, auth_user_id, active')
    .eq('username', username)
    .maybeSingle();

  if (playerError || !player || !player.auth_user_id) {
    return json(400, { error: 'Gebruikersnaam niet gevonden.' });
  }

  if (player.active === false) {
    return json(403, { error: 'Dit account is gedeactiveerd. Neem contact op met een beheerder.' });
  }

  const { error: resetError } = await adminClient.auth.admin.updateUserById(player.auth_user_id, {
    password: newPassword,
  });

  if (resetError) {
    return json(500, { error: `Wachtwoord wijzigen mislukt: ${resetError.message}` });
  }

  const { error: flagError } = await adminClient
    .from('players')
    .update({ must_change_password: false })
    .eq('id', player.id);

  if (flagError) {
    return json(500, { error: `Wachtwoordstatus bijwerken mislukt: ${flagError.message}` });
  }

  return json(200, { success: true });
};