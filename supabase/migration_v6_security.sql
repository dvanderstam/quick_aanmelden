-- ================================================
-- V6: Security fixes - teamAdmin attendance policies
-- ================================================
-- Run this in the Supabase SQL Editor

-- Fix: teamAdmin can also insert attendance for any player in their team
CREATE POLICY "attendance_insert_teamadmin" ON attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid() AND role = 'teamAdmin'
    )
  );

-- Fix: teamAdmin can also update attendance for any player in their team
CREATE POLICY "attendance_update_teamadmin" ON attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid() AND role = 'teamAdmin'
    )
  );

-- Fix: teamAdmin can also delete attendance for any player in their team
CREATE POLICY "attendance_delete_teamadmin" ON attendance
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid() AND role = 'teamAdmin'
    )
  );
