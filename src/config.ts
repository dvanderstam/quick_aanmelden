export const TEAM_NAME = 'Quick Amsterdam';

export const DEFAULT_PASSWORD = 'Quick2026!';

export const QUICK_LOGO_URL =
  'https://quickamsterdam.nl/wp-content/uploads/2022/02/Quick_logo_footer.svg';

export interface TeamConfig {
  id: string;
  name: string;
  shortName: string;
  icsUrl: string;
}

export const TEAMS: TeamConfig[] = [
  {
    id: 'ms1',
    name: 'Quick Amsterdam MS-1',
    shortName: 'MS-1',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/c19eccfc-506d-42df-a579-28bfe45aa3a6/ics',
  },
  {
    id: 'ms3',
    name: 'Quick Amsterdam MS-3',
    shortName: 'MS-3',
    icsUrl: 'https://api.foys.io/competition/public-api/v1/teams/7852aa94-43c5-4f2d-b4d9-85fd46d25ca0/ics',
  },
];
