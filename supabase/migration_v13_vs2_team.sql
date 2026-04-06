-- Migration v13: Add VS-2 team players, memberships, and team-admin roles
-- Run this AFTER migration_v12_mh2_add_players.sql

-- Ensure VS-2 players exist (upsert by username to avoid duplicate person records)
INSERT INTO players (id, name, role, username, must_change_password, disclaimer_accepted)
VALUES
  (60, 'Anousha Brink', 'speler', 'anousha.brink', true, false),
  (61, 'Chiara Mossi', 'speler', 'chiara.mossi', true, false),
  (62, 'Floor van ''t Ende', 'speler', 'floor.vantende', true, false),
  (63, 'Gerianne de Horde', 'speler', 'gerianne.dehorde', true, false),
  (64, 'Loes van der Tuuk', 'speler', 'loes.vandertuuk', true, false),
  (65, 'Lucie van der Vecht', 'speler', 'lucie.vandervecht', true, false),
  (66, 'Malu Pasman', 'speler', 'malu.pasman', true, false),
  (67, 'Michelle Meiners', 'speler', 'michelle.meiners', true, false),
  (68, 'Milou Pol', 'speler', 'milou.pol', true, false),
  (69, 'Sitti Yaumi Salamah', 'speler', 'sitti.yaumi.salamah', true, false),
  (70, 'Sylvia Blommestein-Smit', 'speler', 'sylvia.blommestein.smit', true, false),
  (71, 'Tanja Pepping', 'speler', 'tanja.pepping', true, false),
  (72, 'Tara Amajoute', 'speler', 'tara.amajoute', true, false),
  (73, 'Willy Steinvoorte-Boer', 'speler', 'willy.steinvoorte.boer', true, false),
  (74, 'Zoraima Croes', 'speler', 'zoraima.croes', true, false),
  (75, 'Cor Koning', 'teamAdmin', 'cor.koning', true, false)
ON CONFLICT (username) DO UPDATE
SET
  name = EXCLUDED.name,
  role = CASE
    WHEN players.username = 'cor.koning' THEN 'teamAdmin'
    ELSE players.role
  END,
  must_change_password = EXCLUDED.must_change_password,
  disclaimer_accepted = EXCLUDED.disclaimer_accepted;

-- VS-2 memberships for the listed players (including Cor as VS-2 teamAdmin)
INSERT INTO player_teams (player_id, team_id)
SELECT p.id, 'vs2'
FROM players p
WHERE p.username IN (
  'anousha.brink',
  'chiara.mossi',
  'floor.vantende',
  'gerianne.dehorde',
  'loes.vandertuuk',
  'lucie.vandervecht',
  'malu.pasman',
  'michelle.meiners',
  'milou.pol',
  'sitti.yaumi.salamah',
  'sylvia.blommestein.smit',
  'tanja.pepping',
  'tara.amajoute',
  'willy.steinvoorte.boer',
  'zoraima.croes',
  'cor.koning'
)
ON CONFLICT (player_id, team_id) DO NOTHING;

-- Team-admin role assignment as requested for VS-2
UPDATE players
SET role = 'teamAdmin'
WHERE username IN (
  'sylvia.blommestein.smit',
  'tanja.pepping',
  'floor.vantende',
  'lucie.vandervecht',
  'cor.koning'
);
