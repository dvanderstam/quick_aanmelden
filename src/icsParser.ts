import { Game } from './types';
import { TEAM_NAME } from './config';

function parseICSDate(dateStr: string): Date {
  // Format: 20260327T190000Z
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);
  const hour = parseInt(dateStr.substring(9, 11), 10);
  const minute = parseInt(dateStr.substring(11, 13), 10);
  const second = parseInt(dateStr.substring(13, 15), 10);

  if (dateStr.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return new Date(year, month, day, hour, minute, second);
}

function unescapeICS(value: string): string {
  return value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseOpponent(summary: string): { opponent: string; isHome: boolean } {
  // Summary format: "Team A - Team B"
  const parts = summary.split(' - ');
  if (parts.length !== 2) {
    return { opponent: summary, isHome: false };
  }

  const [home, away] = parts.map((p) => p.trim());
  if (home.includes(TEAM_NAME)) {
    return { opponent: away, isHome: true };
  }
  return { opponent: home, isHome: false };
}

export async function fetchGames(icsUrl: string): Promise<Game[]> {
  const response = await fetch(icsUrl);
  const text = await response.text();
  return parseICS(text);
}

export function parseICS(icsText: string): Game[] {
  const games: Game[] = [];
  const events = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < events.length; i++) {
    const block = events[i].split('END:VEVENT')[0];
    const lines = block.split(/\r?\n/);

    let uid = '';
    let summary = '';
    let location = '';
    let dtstart = '';
    let dtend = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('UID:')) uid = trimmed.substring(4);
      else if (trimmed.startsWith('SUMMARY:')) summary = unescapeICS(trimmed.substring(8));
      else if (trimmed.startsWith('LOCATION:')) location = unescapeICS(trimmed.substring(9));
      else if (trimmed.startsWith('DTSTART:')) dtstart = trimmed.substring(8);
      else if (trimmed.startsWith('DTEND:')) dtend = trimmed.substring(6);
    }

    if (uid && summary && dtstart) {
      const { opponent, isHome } = parseOpponent(summary);
      games.push({
        id: uid,
        summary,
        location,
        startDate: parseICSDate(dtstart),
        endDate: dtend ? parseICSDate(dtend) : parseICSDate(dtstart),
        isHome,
        opponent,
      });
    }
  }

  games.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return games;
}
