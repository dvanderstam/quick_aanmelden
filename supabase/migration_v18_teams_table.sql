-- Migration v18: database-driven teams/settings
-- Run this AFTER migration_v17_player_team_count_in_player_list.sql

CREATE TABLE IF NOT EXISTS public.teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  short_name text NOT NULL,
  ics_url text NOT NULL DEFAULT '',
  enable_replacement_flow boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_active_short_name_idx
ON public.teams (active, short_name);

INSERT INTO public.teams (id, name, short_name, ics_url, enable_replacement_flow, active)
VALUES
  ('ms1', 'Quick Amsterdam MS-1', 'MS-1', 'https://api.foys.io/competition/public-api/v1/teams/c19eccfc-506d-42df-a579-28bfe45aa3a6/ics', true, true),
  ('ms2', 'Quick Amsterdam MS-2', 'MS-2', 'https://api.foys.io/competition/public-api/v1/teams/c2f087d1-1637-4e16-b894-86c5a6131bcc/ics', true, true),
  ('mh2', 'Quick Amsterdam MH-2', 'MH-2', 'https://api.foys.io/competition/public-api/v1/teams/53e79bdc-023a-48b2-ab93-a1d094b7eebe/ics', true, true),
  ('vs1', 'Quick Amsterdam VS-1', 'VS-1', 'https://api.foys.io/competition/public-api/v1/teams/eaa86cf5-a01c-40af-bf8c-ea506d0d355c/ics', false, true),
  ('vs2', 'Quick Amsterdam VS-2', 'VS-2', 'https://api.foys.io/competition/public-api/v1/teams/14d3a7cb-137d-4ba3-935a-12302b5f4bb8/ics', true, true),
  ('ms3', 'Quick Amsterdam MS-3', 'MS-3', 'https://api.foys.io/competition/public-api/v1/teams/7852aa94-43c5-4f2d-b4d9-85fd46d25ca0/ics', false, true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  ics_url = EXCLUDED.ics_url,
  enable_replacement_flow = EXCLUDED.enable_replacement_flow,
  active = EXCLUDED.active,
  updated_at = now();

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teams'
      AND policyname = 'teams_select_authenticated'
  ) THEN
    CREATE POLICY teams_select_authenticated ON public.teams
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teams'
      AND policyname = 'teams_write_admin_only'
  ) THEN
    CREATE POLICY teams_write_admin_only ON public.teams
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.players
          WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.players
          WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'player_teams_team_id_fkey'
      AND conrelid = 'public.player_teams'::regclass
  ) THEN
    ALTER TABLE public.player_teams
      ADD CONSTRAINT player_teams_team_id_fkey
      FOREIGN KEY (team_id)
      REFERENCES public.teams (id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$$;
