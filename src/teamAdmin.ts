import { Platform } from 'react-native';
import { getTeamConfig, getTeamConfigs, loadTeamConfigs, TeamConfig } from './config';
import { Player } from './types';
import { supabase } from './supabase';

function slugifyPart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

export function suggestUsername(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map(slugifyPart)
    .filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export function getManagedTeams(player: Player | null): TeamConfig[] {
  if (!player) return [];
  if (player.role === 'admin') return getTeamConfigs();

  const teamIds = new Set(player.role === 'teamAdmin' ? player.team_ids || [] : []);
  return [...teamIds]
    .map((teamId) => getTeamConfig(teamId))
    .filter((team): team is TeamConfig => !!team);
}

export async function getTeams(includeInactive = false): Promise<TeamConfig[]> {
  return loadTeamConfigs({ includeInactive });
}

function getFunctionUrl(path: string): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  if (Platform.OS !== 'web') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL ontbreekt voor deze omgeving.');
  }

  return path;
}

export type CreateOrLinkPlayerResult = 'created' | 'linked' | 'already-linked';

export interface CreateOrLinkPlayerResponse {
  result: CreateOrLinkPlayerResult;
  player: {
    id: number;
    name: string;
    username: string;
    authUserCreated: boolean;
  };
  nameMismatch: boolean;
  mustChangePassword: boolean;
}

export interface CreateTeamInput {
  teamId: string;
  name: string;
  shortName: string;
  icsUrl: string;
  enableReplacementFlow: boolean;
  active: boolean;
}

export interface CreateTeamResponse {
  team: TeamConfig;
}

export interface UpdateTeamInput {
  teamId: string;
  name: string;
  shortName: string;
  icsUrl: string;
  enableReplacementFlow: boolean;
  active: boolean;
}

export type BulkImportStatus = 'created' | 'linked' | 'already-linked' | 'error';

export interface BulkImportResultRow {
  lineNumber: number;
  name: string;
  username: string | null;
  status: BulkImportStatus;
  error: string | null;
}

export interface BulkImportResponse {
  summary: {
    total: number;
    created: number;
    linked: number;
    alreadyLinked: number;
    errors: number;
  };
  results: BulkImportResultRow[];
}

export async function createOrLinkPlayer(input: {
  name: string;
  teamId: string;
  username: string;
}): Promise<CreateOrLinkPlayerResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/create-or-link-player'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Speler toevoegen mislukt.');
  }

  return payload as CreateOrLinkPlayerResponse;
}

export async function removePlayerFromTeam(playerId: number, teamId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/remove-player-from-team'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ playerId, teamId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Speler verwijderen mislukt.');
  }
}

export async function setPlayerActive(playerId: number, active: boolean): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/set-player-active'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ playerId, active }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Status bijwerken mislukt.');
  }
}

export async function resetPlayerPasswordToDefault(playerId: number): Promise<{ username: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/reset-player-password'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ playerId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Wachtwoord resetten mislukt.');
  }

  return { username: payload.username };
}

export async function setPlayerTeams(
  playerId: number,
  teamIds: string[],
  captainTeamIds: string[] = [],
  nonCountedTeamIds: string[] = []
): Promise<{ teamIds: string[]; captainTeamIds: string[]; nonCountedTeamIds: string[] }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/set-player-teams'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ playerId, teamIds, captainTeamIds, nonCountedTeamIds }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Teams bijwerken mislukt.');
  }

  return {
    teamIds: Array.isArray(payload.teamIds) ? payload.teamIds : teamIds,
    captainTeamIds: Array.isArray(payload.captainTeamIds) ? payload.captainTeamIds : captainTeamIds,
    nonCountedTeamIds: Array.isArray(payload.nonCountedTeamIds) ? payload.nonCountedTeamIds : nonCountedTeamIds,
  };
}

export async function updatePlayerProfile(
  playerId: number,
  name: string,
  username: string
): Promise<{ id: number; name: string; username: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/update-player-profile'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ playerId, name, username }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Spelerprofiel bijwerken mislukt.');
  }

  return payload.player as { id: number; name: string; username: string };
}

export async function createTeam(input: CreateTeamInput): Promise<CreateTeamResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/create-team'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Team aanmaken mislukt.');
  }

  return payload as CreateTeamResponse;
}

export async function bulkImportTeamPlayers(input: {
  teamId: string;
  namesText: string;
}): Promise<BulkImportResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/bulk-import-team-players'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Bulk import mislukt.');
  }

  return payload as BulkImportResponse;
}

export async function updateTeam(input: UpdateTeamInput): Promise<CreateTeamResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(getFunctionUrl('/.netlify/functions/update-team'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Team bijwerken mislukt.');
  }

  return payload as CreateTeamResponse;
}