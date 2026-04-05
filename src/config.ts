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
}

export const TEAMS: TeamConfig[] = [
  {
    id: 'ms1',
    name: 'Quick Amsterdam MS-1',
    shortName: 'MS-1',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/c19eccfc-506d-42df-a579-28bfe45aa3a6/ics',
    enableReplacementFlow: true,
  },
  {
    id: 'mh2',
    name: 'Quick Amsterdam MH-2',
    shortName: 'MH-2',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/53e79bdc-023a-48b2-ab93-a1d094b7eebe/ics',
    enableReplacementFlow: true,
  },
  {
    id: 'vs1',
    name: 'Quick Amsterdam VS-1',
    shortName: 'VS-1',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/eaa86cf5-a01c-40af-bf8c-ea506d0d355c/ics',
    enableReplacementFlow: false,
  },
  {
    id: 'ms3',
    name: 'Quick Amsterdam MS-3',
    shortName: 'MS-3',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/7852aa94-43c5-4f2d-b4d9-85fd46d25ca0/ics',
    enableReplacementFlow: false,
  },
];

export function getTeamConfig(teamId: string): TeamConfig | undefined {
  return TEAMS.find((team) => team.id === teamId);
}

export function teamHasReplacementFlow(teamId: string): boolean {
  return getTeamConfig(teamId)?.enableReplacementFlow ?? false;
}
