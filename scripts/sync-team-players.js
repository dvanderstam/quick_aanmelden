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
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return env;
}

function parseArgs(argv) {
  const args = {
    team: null,
    file: null,
    defaultRole: 'speler',
  };

  // Support positional usage: node script.js <team_id> <file>
  if (argv[2] && !argv[2].startsWith('--')) {
    args.team = argv[2] || null;
    if (argv[3] && !argv[3].startsWith('--')) {
      args.file = argv[3] || null;
    }
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--team') {
      args.team = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (token === '--file') {
      args.file = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (token === '--default-role') {
      args.defaultRole = argv[i + 1] || 'speler';
      i += 1;
    }
  }

  if (!args.team || !args.file) {
    throw new Error('Usage: node scripts/sync-team-players.js --team <team_id> --file <names-file> [--default-role speler]');
  }

  return args;
}

function parseNamesFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const players = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.includes(':')) continue;

    const idx = line.indexOf(':');
    const name = line.slice(0, idx).trim();
    const username = line.slice(idx + 1).trim().toLowerCase();

    if (!name || !username) continue;
    players.push({ name, username });
  }

  if (players.length === 0) {
    throw new Error(`No players found in ${filePath}`);
  }

  return players;
}

function toEmail(username) {
  return `${username}@${EMAIL_DOMAIN}`;
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

  if (!error && data?.user?.id) return data.user.id;

  const message = (error?.message || '').toLowerCase();
  const alreadyExists = message.includes('already') || message.includes('exists');
  if (!alreadyExists) {
    throw new Error(`createUser failed for ${email}: ${error?.message || 'unknown error'}`);
  }

  const existing = await findUserByEmail(adminClient, email);
  if (!existing?.id) throw new Error(`Could not resolve existing auth user for ${email}`);
  return existing.id;
}

async function getMaxPlayerId(adminClient) {
  const { data, error } = await adminClient
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not read max player id: ${error.message}`);
  return data?.id || 0;
}

async function main() {
  const args = parseArgs(process.argv);

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env not found in project root');
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

  const filePath = path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) throw new Error(`Names file not found: ${filePath}`);

  const desiredPlayers = parseNamesFile(filePath);
  const usernames = [...new Set(desiredPlayers.map((p) => p.username))];

  const { data: existingRows, error: existingError } = await adminClient
    .from('players')
    .select('id,name,role,username,must_change_password,disclaimer_accepted,auth_user_id')
    .in('username', usernames);

  if (existingError) throw new Error(`Could not load existing players: ${existingError.message}`);

  const byUsername = new Map((existingRows || []).map((r) => [r.username, r]));
  let nextId = (await getMaxPlayerId(adminClient)) + 1;

  const upsertRows = desiredPlayers.map((p) => {
    const existing = byUsername.get(p.username);
    if (existing) {
      return {
        id: existing.id,
        name: p.name,
        role: existing.role || args.defaultRole,
        username: p.username,
        must_change_password:
          typeof existing.must_change_password === 'boolean' ? existing.must_change_password : true,
        disclaimer_accepted:
          typeof existing.disclaimer_accepted === 'boolean' ? existing.disclaimer_accepted : false,
      };
    }

    const row = {
      id: nextId,
      name: p.name,
      role: args.defaultRole,
      username: p.username,
      must_change_password: true,
      disclaimer_accepted: false,
    };
    nextId += 1;
    return row;
  });

  const { error: upsertPlayersError } = await adminClient
    .from('players')
    .upsert(upsertRows, { onConflict: 'id' });
  if (upsertPlayersError) throw new Error(`Upsert players failed: ${upsertPlayersError.message}`);

  const { data: syncedRows, error: syncedError } = await adminClient
    .from('players')
    .select('id,name,username,auth_user_id')
    .in('username', usernames);
  if (syncedError) throw new Error(`Reload synced players failed: ${syncedError.message}`);

  const memberships = (syncedRows || []).map((p) => ({ player_id: p.id, team_id: args.team }));
  const { error: membershipsError } = await adminClient
    .from('player_teams')
    .upsert(memberships, { onConflict: 'player_id,team_id', ignoreDuplicates: true });
  if (membershipsError) throw new Error(`Upsert team memberships failed: ${membershipsError.message}`);

  for (const p of syncedRows || []) {
    if (p.auth_user_id) continue;

    const email = toEmail(p.username);
    const authUserId = await ensureAuthUser(adminClient, email, defaultPassword);

    const { error: linkError } = await adminClient
      .from('players')
      .update({ auth_user_id: authUserId })
      .eq('id', p.id)
      .is('auth_user_id', null);

    if (linkError) throw new Error(`Linking auth_user_id failed for ${p.username}: ${linkError.message}`);
  }

  const { data: verifyRows, error: verifyRowsError } = await adminClient
    .from('players')
    .select('id,name,username,auth_user_id')
    .in('username', usernames)
    .order('id', { ascending: true });
  if (verifyRowsError) throw new Error(`Verify players failed: ${verifyRowsError.message}`);

  const ids = (verifyRows || []).map((r) => r.id);
  const { data: verifyMemberships, error: verifyMembershipsError } = await adminClient
    .from('player_teams')
    .select('player_id,team_id')
    .eq('team_id', args.team)
    .in('player_id', ids)
    .order('player_id', { ascending: true });
  if (verifyMembershipsError) throw new Error(`Verify memberships failed: ${verifyMembershipsError.message}`);

  console.log(`Synced ${verifyRows?.length || 0} players for team ${args.team}:`);
  for (const row of verifyRows || []) {
    console.log(
      `- ${row.id}: ${row.name} (${row.username}) | auth_user_id=${row.auth_user_id ? 'SET' : 'NULL'}`
    );
  }

  console.log(`Memberships in ${args.team}: ${verifyMemberships?.length || 0}`);

  const missingAuth = (verifyRows || []).filter((r) => !r.auth_user_id);
  if (missingAuth.length > 0) {
    process.exitCode = 2;
    console.error('Some players still miss auth_user_id.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});