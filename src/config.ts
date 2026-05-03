import { supabase } from './supabase';

export const TEAM_NAME = 'Quick Amsterdam';

// Default password loaded from environment variable - never hardcode!
export const DEFAULT_PASSWORD = process.env.EXPO_PUBLIC_DEFAULT_PASSWORD || '';

export const QUICK_LOGO_URL =
  'https://quickamsterdam.nl/wp-content/uploads/2022/02/Quick_logo_footer.svg';

export interface TeamConfig {
  id: string;
  name: string;
  shortName: string;
  icsUrl: string;
  enableReplacementFlow: boolean;
  enableReplacementNameEntry: boolean;
  active?: boolean;
}

export const TEAMS: TeamConfig[] = [
  {
    id: 'ms1',
    name: 'Quick Amsterdam MS-1',
    shortName: 'MS-1',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/c19eccfc-506d-42df-a579-28bfe45aa3a6/ics',
    enableReplacementFlow: true,
    enableReplacementNameEntry: false,
  },
  {
    id: 'ms2',
    name: 'Quick Amsterdam MS-2',
    shortName: 'MS-2',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/c2f087d1-1637-4e16-b894-86c5a6131bcc/ics',
    enableReplacementFlow: true,
    enableReplacementNameEntry: false,
  },
  {
    id: 'mh2',
    name: 'Quick Amsterdam MH-2',
    shortName: 'MH-2',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/53e79bdc-023a-48b2-ab93-a1d094b7eebe/ics',
    enableReplacementFlow: true,
    enableReplacementNameEntry: false,
  },
  {
    id: 'vs1',
    name: 'Quick Amsterdam VS-1',
    shortName: 'VS-1',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/eaa86cf5-a01c-40af-bf8c-ea506d0d355c/ics',
    enableReplacementFlow: false,
    enableReplacementNameEntry: false,
  },
  {
    id: 'vs2',
    name: 'Quick Amsterdam VS-2',
    shortName: 'VS-2',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/14d3a7cb-137d-4ba3-935a-12302b5f4bb8/ics',
    enableReplacementFlow: true,
    enableReplacementNameEntry: false,
  },
  {
    id: 'ms3',
    name: 'Quick Amsterdam MS-3',
    shortName: 'MS-3',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/7852aa94-43c5-4f2d-b4d9-85fd46d25ca0/ics',
    enableReplacementFlow: false,
    enableReplacementNameEntry: false,
  },
];

let runtimeTeams: TeamConfig[] = [...TEAMS];

function normalizeTeamRow(row: {
  id: string;
  name: string;
  short_name: string;
  ics_url: string | null;
  enable_replacement_flow: boolean | null;
  enable_replacement_name_entry?: boolean | null;
  active: boolean | null;
}): TeamConfig {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    icsUrl: row.ics_url || '',
    enableReplacementFlow: row.enable_replacement_flow === true,
    enableReplacementNameEntry: row.enable_replacement_name_entry === true,
    active: row.active !== false,
  };
}

export function getTeamConfigs(): TeamConfig[] {
  return runtimeTeams;
}

export function setTeamConfigs(teams: TeamConfig[]): void {
  runtimeTeams = teams.length > 0 ? [...teams] : [...TEAMS];
}

export async function loadTeamConfigs(options: { includeInactive?: boolean } = {}): Promise<TeamConfig[]> {
  const withReplacementNameField = supabase
    .from('teams')
    .select('id, name, short_name, ics_url, enable_replacement_flow, enable_replacement_name_entry, active')
    .order('short_name');

  if (!options.includeInactive) {
    withReplacementNameField.eq('active', true);
  }

  const withReplacementNameResult = await withReplacementNameField;

  // During rollout we gracefully fallback when the new column is not available yet.
  if (withReplacementNameResult.error && /enable_replacement_name_entry|column/i.test(withReplacementNameResult.error.message || '')) {
    const fallbackQuery = supabase
      .from('teams')
      .select('id, name, short_name, ics_url, enable_replacement_flow, active')
      .order('short_name');

    if (!options.includeInactive) {
      fallbackQuery.eq('active', true);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;

    if (fallbackError && /teams|relation|does not exist|schema cache/i.test(fallbackError.message || '')) {
      return getTeamConfigs();
    }

    if (fallbackError) {
      throw fallbackError;
    }

    const mappedFallback = (fallbackData || []).map((row) => normalizeTeamRow({
      ...row,
      enable_replacement_name_entry: false,
    }));
    setTeamConfigs(mappedFallback);
    return getTeamConfigs();
  }

  const { data, error } = withReplacementNameResult;

  // During rollout we keep static fallback teams when DB table/migration is not available yet.
  if (error && /teams|relation|does not exist|schema cache/i.test(error.message || '')) {
    return getTeamConfigs();
  }

  if (error) {
    throw error;
  }

  const mapped = (data || []).map(normalizeTeamRow);
  setTeamConfigs(mapped);
  return getTeamConfigs();
}

export function getTeamConfig(teamId: string): TeamConfig | undefined {
  return getTeamConfigs().find((team) => team.id === teamId)
    || TEAMS.find((team) => team.id === teamId);
}

export function teamHasReplacementFlow(teamId: string): boolean {
  return getTeamConfig(teamId)?.enableReplacementFlow ?? false;
}

export function teamHasReplacementNameEntry(teamId: string): boolean {
  return getTeamConfig(teamId)?.enableReplacementNameEntry ?? false;
}
