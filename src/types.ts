export interface Game {
  id: string;
  summary: string;
  location: string;
  startDate: Date;
  endDate: Date;
  isHome: boolean;
  opponent: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'uncertain' | null;

export type PlayerRole = 'admin' | 'speler';

export interface Player {
  id: number;
  name: string;
  username: string;
  role: PlayerRole;
  auth_user_id: string | null;
  must_change_password: boolean;
}
