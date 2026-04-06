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
  let team = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--team') { team = argv[i + 1] || null; i++; }
    else if (!argv[i].startsWith('--') && !team) { team = argv[i]; }
  }
  return { team };
}

async function main() {
  const args = parseArgs(process.argv);

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env not found in project root');
  const env = parseEnv(envPath);

  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Load players (optionally filtered by team)
  let query = adminClient.from('players').select('id, name, username, auth_user_id');
  if (args.team) {
    const { data: memberships } = await adminClient
      .from('player_teams')
      .select('player_id')
      .eq('team_id', args.team);
    const ids = (memberships || []).map((m) => m.player_id);
    if (ids.length === 0) {
      console.log(`No players found for team ${args.team}`);
      return;
    }
    query = query.in('id', ids);
  }

  const { data: players, error } = await query.order('id');
  if (error) throw new Error(`Could not load players: ${error.message}`);

  const problems = [];
  let checked = 0;

  for (const p of players || []) {
    checked++;
    const expectedEmail = `${p.username}@${EMAIL_DOMAIN}`;

    // Check 1: auth_user_id must be set
    if (!p.auth_user_id) {
      problems.push({ player: p.username, issue: 'Geen auth_user_id — kan niet inloggen' });
      continue;
    }

    // Check 2: auth user must exist
    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(p.auth_user_id);
    if (authError || !authData?.user) {
      problems.push({ player: p.username, issue: `Auth user ${p.auth_user_id} bestaat niet` });
      continue;
    }

    const authUser = authData.user;

    // Check 3: email domain must be correct
    if (authUser.email !== expectedEmail) {
      problems.push({
        player: p.username,
        issue: `Email mismatch: ${authUser.email} (verwacht: ${expectedEmail})`,
      });
    }

    // Check 4: email must be confirmed
    if (!authUser.email_confirmed_at) {
      problems.push({ player: p.username, issue: 'Email niet bevestigd' });
    }
  }

  const scope = args.team ? `team ${args.team}` : 'alle spelers';
  console.log(`\nVerify ${scope}: ${checked} spelers gecontroleerd\n`);

  if (problems.length === 0) {
    console.log('✓ Alles OK — geen problemen gevonden.\n');
    process.exit(0);
  } else {
    console.log(`✗ ${problems.length} probleem(en) gevonden:\n`);
    for (const p of problems) {
      console.log(`  - ${p.player}: ${p.issue}`);
    }
    console.log('\nFix: npm run sync:team-players -- --team <team_id> --file <inlognamen.txt>\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
