-- ================================================
-- V3: Multi-team support
-- ================================================
-- Run this in the Supabase SQL Editor

-- Player-team junction table
create table player_teams (
  player_id integer not null references players(id) on delete cascade,
  team_id text not null,
  primary key (player_id, team_id)
);

alter table player_teams enable row level security;

-- Everyone authenticated can see team memberships
create policy "player_teams_select" on player_teams
  for select using (auth.role() = 'authenticated');

-- Seed: all existing players belong to MS-1
insert into player_teams (player_id, team_id)
select id, 'ms1' from players where id <= 12;

-- Ceriel Franken (id=13) belongs to MS-3
insert into player_teams (player_id, team_id)
values (13, 'ms3');

-- HP Harmsen (id=14) belongs to MS-1
insert into player_teams (player_id, team_id)
values (14, 'ms1');
