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

function emailFor(username) {
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
  if (!message.includes('already') && !message.includes('exists')) {
    throw new Error(`createUser failed for ${email}: ${error?.message || 'unknown error'}`);
  }

  const existing = await findUserByEmail(adminClient, email);
  if (!existing?.id) throw new Error(`Could not resolve existing auth user for ${email}`);
  return existing.id;
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
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

  // Cor is a VS-2 teamAdmin.
  const corDefaults = {
    id: 75,
    name: 'Cor Koning',
    role: 'teamAdmin',
    username: 'cor.koning',
    must_change_password: true,
    disclaimer_accepted: false,
  };

  const { error: corUpsertError } = await adminClient
    .from('players')
    .upsert(corDefaults, { onConflict: 'username' });
  if (corUpsertError) throw new Error(`Could not upsert Cor Koning: ${corUpsertError.message}`);

  const { data: corPlayer, error: corLookupError } = await adminClient
    .from('players')
    .select('id,auth_user_id')
    .eq('username', 'cor.koning')
    .single();
  if (corLookupError || !corPlayer) {
    throw new Error(`Could not find Cor Koning after upsert: ${corLookupError?.message || 'not found'}`);
  }

  let corAuthId = corPlayer.auth_user_id;
  if (!corAuthId) {
    const corEmail = emailFor('cor.koning');
    corAuthId = await ensureAuthUser(adminClient, corEmail, defaultPassword);
  }

  const { error: corMembershipError } = await adminClient
    .from('player_teams')
    .upsert({ player_id: corPlayer.id, team_id: 'vs2' }, { onConflict: 'player_id,team_id' });
  if (corMembershipError) {
    throw new Error(`Could not ensure Cor VS-2 membership: ${corMembershipError.message}`);
  }

  const { error: corLinkError } = await adminClient
    .from('players')
    .update({ auth_user_id: corAuthId, role: 'teamAdmin' })
    .eq('username', 'cor.koning');
  if (corLinkError) throw new Error(`Could not link Cor auth_user_id: ${corLinkError.message}`);

  const teamAdminUsernames = [
    'cor.koning',
    'sylvia.blommestein.smit',
    'tanja.pepping',
    'floor.vantende',
    'lucie.vandervecht',
  ];

  const { error: teamAdminsError } = await adminClient
    .from('players')
    .update({ role: 'teamAdmin' })
    .in('username', teamAdminUsernames);
  if (teamAdminsError) throw new Error(`Could not set VS-2 teamAdmins: ${teamAdminsError.message}`);

  const { data: verifyRoles, error: verifyRolesError } = await adminClient
    .from('players')
    .select('id,name,username,role,auth_user_id')
    .in('username', [...teamAdminUsernames, 'cor.koning'])
    .order('username', { ascending: true });

  if (verifyRolesError) throw new Error(`Could not verify admin roles: ${verifyRolesError.message}`);

  console.log('VS-2 admin role result:');
  for (const row of verifyRoles || []) {
    console.log(`- ${row.username}: role=${row.role}, auth_user_id=${row.auth_user_id ? 'SET' : 'NULL'}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});