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

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }

  return env;
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env not found in project root');
  }

  const env = parseEnv(envPath);
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const players = [
    { id: 34, name: 'Sven Maureau', role: 'speler', username: 'sven.maureau', must_change_password: true, disclaimer_accepted: false },
    { id: 35, name: 'Eric Bernhard', role: 'speler', username: 'eric.bernhard', must_change_password: true, disclaimer_accepted: false },
    { id: 36, name: 'Martin van Unen', role: 'speler', username: 'martin.vanunen', must_change_password: true, disclaimer_accepted: false },
    { id: 37, name: 'Jayrone Nahr', role: 'speler', username: 'jayrone.nahr', must_change_password: true, disclaimer_accepted: false },
  ];

  const { error: upsertPlayersError } = await supabase
    .from('players')
    .upsert(players, { onConflict: 'id' });

  if (upsertPlayersError) {
    throw new Error(`Upsert players failed: ${upsertPlayersError.message}`);
  }

  const memberships = [
    { player_id: 34, team_id: 'mh2' },
    { player_id: 35, team_id: 'mh2' },
    { player_id: 36, team_id: 'mh2' },
    { player_id: 37, team_id: 'mh2' },
  ];

  const { error: upsertMembershipsError } = await supabase
    .from('player_teams')
    .upsert(memberships, { onConflict: 'player_id,team_id', ignoreDuplicates: true });

  if (upsertMembershipsError) {
    throw new Error(`Upsert player_teams failed: ${upsertMembershipsError.message}`);
  }

  const { data: verifyPlayers, error: verifyPlayersError } = await supabase
    .from('players')
    .select('id,name,username')
    .in('id', [34, 35, 36, 37])
    .order('id', { ascending: true });

  if (verifyPlayersError) {
    throw new Error(`Verify players failed: ${verifyPlayersError.message}`);
  }

  const { data: verifyTeams, error: verifyTeamsError } = await supabase
    .from('player_teams')
    .select('player_id,team_id')
    .eq('team_id', 'mh2')
    .in('player_id', [34, 35, 36, 37])
    .order('player_id', { ascending: true });

  if (verifyTeamsError) {
    throw new Error(`Verify team memberships failed: ${verifyTeamsError.message}`);
  }

  console.log('Players in DB:');
  for (const p of verifyPlayers || []) {
    console.log(`- ${p.id}: ${p.name} (${p.username})`);
  }

  console.log('MH2 memberships:');
  for (const t of verifyTeams || []) {
    console.log(`- player_id=${t.player_id}, team_id=${t.team_id}`);
  }

  if ((verifyPlayers || []).length !== 4 || (verifyTeams || []).length !== 4) {
    process.exitCode = 2;
    console.error('Verification incomplete: expected 4 players and 4 memberships.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});