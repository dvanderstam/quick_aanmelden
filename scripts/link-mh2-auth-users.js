const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const EMAIL_DOMAIN = 'quick.local';

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }

  return env;
}

function toEmail(username) {
  return `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
}

async function findUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    const users = data?.users || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAuthUser(adminClient, email, defaultPassword) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
  });

  if (!error && data?.user?.id) {
    return data.user.id;
  }

  const alreadyExists =
    (error?.message || '').toLowerCase().includes('already') ||
    (error?.message || '').toLowerCase().includes('exists');

  if (!alreadyExists) {
    throw new Error(`createUser failed for ${email}: ${error?.message || 'unknown error'}`);
  }

  const existing = await findUserByEmail(adminClient, email);
  if (!existing?.id) {
    throw new Error(`Could not resolve existing auth user for ${email}`);
  }
  return existing.id;
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env not found in project root');
  }

  const env = parseEnv(envPath);
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultPassword = env.EXPO_PUBLIC_DEFAULT_PASSWORD || env.DEFAULT_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey || !defaultPassword) {
    throw new Error('Missing SUPABASE URL, SUPABASE_SERVICE_ROLE_KEY, or DEFAULT_PASSWORD in .env');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const targetPlayerIds = [34, 35, 36, 37];
  const { data: players, error: playersError } = await adminClient
    .from('players')
    .select('id,name,username,auth_user_id')
    .in('id', targetPlayerIds)
    .order('id', { ascending: true });

  if (playersError) throw new Error(`Could not load players: ${playersError.message}`);
  if (!players || players.length !== 4) {
    throw new Error(`Expected 4 target players, got ${players?.length || 0}`);
  }

  for (const player of players) {
    if (player.auth_user_id) {
      continue;
    }

    const email = toEmail(player.username);
    const authUserId = await ensureAuthUser(adminClient, email, defaultPassword);

    const { error: updateError } = await adminClient
      .from('players')
      .update({ auth_user_id: authUserId })
      .eq('id', player.id)
      .is('auth_user_id', null);

    if (updateError) {
      throw new Error(`Failed to link auth_user_id for player ${player.id}: ${updateError.message}`);
    }
  }

  const { data: verify, error: verifyError } = await adminClient
    .from('players')
    .select('id,name,username,auth_user_id')
    .in('id', targetPlayerIds)
    .order('id', { ascending: true });

  if (verifyError) throw new Error(`Verification failed: ${verifyError.message}`);

  console.log('MH2 players auth linkage:');
  for (const row of verify || []) {
    const status = row.auth_user_id ? 'linked' : 'missing';
    console.log(`- ${row.id}: ${row.name} (${row.username}) => ${status}`);
  }

  const missing = (verify || []).filter((r) => !r.auth_user_id);
  if (missing.length > 0) {
    process.exitCode = 2;
    console.error('Some players still miss auth_user_id.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});