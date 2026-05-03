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
  let username = null;

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--username') {
      username = (argv[i + 1] || '').toLowerCase().trim();
      i += 1;
    }
  }

  if (!username) {
    throw new Error('Usage: node scripts/reset-player-password.js --username <username>');
  }

  return { username };
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

  const email = toEmail(args.username);
  console.log(`\nResetting password for: ${args.username} (${email})`);

  // 1. Look up player in players table
  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, name, username, auth_user_id, must_change_password')
    .eq('username', args.username)
    .maybeSingle();

  if (playerError) throw new Error(`Player lookup failed: ${playerError.message}`);
  if (!player) throw new Error(`Player not found with username: ${args.username}`);

  console.log(`Found player: ${player.name} (id=${player.id}, auth_user_id=${player.auth_user_id})`);

  // 2. Find auth user
  let authUserId = player.auth_user_id;

  if (!authUserId) {
    console.log('No auth_user_id linked, searching by email...');
    const authUser = await findUserByEmail(adminClient, email);
    if (!authUser) throw new Error(`No auth user found for email: ${email}`);
    authUserId = authUser.id;
    console.log(`Found auth user by email: ${authUserId}`);
  }

  // 3. Reset auth password to DEFAULT_PASSWORD
  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(authUserId, {
    password: defaultPassword,
  });

  if (updateAuthError) {
    throw new Error(`Failed to reset auth password: ${updateAuthError.message}`);
  }

  console.log('Auth password reset to DEFAULT_PASSWORD.');

  // 4. Set must_change_password = true in players table
  const { error: updatePlayerError } = await adminClient
    .from('players')
    .update({ must_change_password: true })
    .eq('id', player.id);

  if (updatePlayerError) {
    throw new Error(`Failed to update must_change_password: ${updatePlayerError.message}`);
  }

  console.log('Set must_change_password = true.');
  console.log(`\nDone! ${player.name} can now log in and will be prompted to set a new password.`);
}

main().catch((err) => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
