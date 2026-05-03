const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  const env = parseEnv(envPath);

  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const teamAdminUsernames = ['hans'];

  const { error: updateError } = await adminClient
    .from('players')
    .update({ role: 'teamAdmin' })
    .in('username', teamAdminUsernames);
  if (updateError) {
    throw new Error(`Could not set MS-3 teamAdmins: ${updateError.message}`);
  }

  const { data, error } = await adminClient
    .from('players')
    .select('id,name,username,role,auth_user_id')
    .in('username', teamAdminUsernames)
    .order('username', { ascending: true });
  if (error) {
    throw new Error(`Could not verify MS-3 teamAdmins: ${error.message}`);
  }

  console.log('MS-3 admin role result:');
  for (const row of data || []) {
    console.log(`- ${row.username}: role=${row.role}, auth_user_id=${row.auth_user_id ? 'SET' : 'NULL'}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
