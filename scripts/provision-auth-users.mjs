import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getArgValue(name, fallback) {
  const prefix = `--${name}=`;
  const exact = process.argv.find((arg) => arg.startsWith(prefix));
  if (exact) return exact.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return fallback;
}

async function main() {
  const envFile = getArgValue('env', '.env');
  loadEnvFile(path.resolve(process.cwd(), envFile));

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultPassword = process.env.EXPO_PUBLIC_DEFAULT_PASSWORD;
  const teamId = getArgValue('team', 'vs1');
  const dryRun = process.argv.includes('--dry-run');
  const domainList = (process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAINS || 'quick.local')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const emailDomain = getArgValue('domain', domainList[0] || 'quick.local');

  if (!supabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!defaultPassword) {
    throw new Error('Missing EXPO_PUBLIC_DEFAULT_PASSWORD.');
  }

  console.log(`Using env file: ${envFile}`);
  console.log(`Target team: ${teamId}${dryRun ? ' (dry-run)' : ''}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: players, error: playerError } = await supabase
    .from('players')
    .select('id, username, auth_user_id, must_change_password, disclaimer_accepted, player_teams!inner(team_id)')
    .eq('player_teams.team_id', teamId)
    .is('auth_user_id', null)
    .order('id');

  if (playerError) throw playerError;

  const targets = (players ?? []).filter((player) => player?.username);

  if (targets.length === 0) {
    console.log(`No players without auth_user_id found for team ${teamId}.`);
    return;
  }

  console.log(`Found ${targets.length} player(s) without auth_user_id for team ${teamId}.`);

  for (const player of targets) {
    const email = `${player.username.toLowerCase().trim()}@${emailDomain}`;

    if (dryRun) {
      console.log(
        JSON.stringify({
          username: player.username,
          email,
          action: 'create-and-link-user',
        })
      );
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        username: player.username,
        provisionedBy: 'scripts/provision-auth-users.mjs',
      },
    });

    if (error) {
      console.log(
        JSON.stringify({
          username: player.username,
          email,
          action: 'create-failed',
          reason: error.message,
        })
      );
      continue;
    }

    const authUser = data.user;

    const { error: updateError } = await supabase
      .from('players')
      .update({
        auth_user_id: authUser.id,
        must_change_password: true,
        disclaimer_accepted: false,
      })
      .eq('id', player.id);

    if (updateError) throw updateError;

    console.log(
      JSON.stringify({
        username: player.username,
        email,
        auth_user_id: authUser.id,
        action: 'created-and-linked-user',
      })
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});