-- Migration to fix game_hints table and RLS policies
-- Run this in Supabase SQL Editor

-- Add user_id column if it doesn't exist
ALTER TABLE game_hints
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Add round_number column if it doesn't exist  
ALTER TABLE game_hints
ADD COLUMN IF NOT EXISTS round_number integer DEFAULT 1;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_hints_room_id ON game_hints(room_id);
CREATE INDEX IF NOT EXISTS idx_game_hints_user_id ON game_hints(user_id);

-- Disable RLS completely for game tables (since we're not using Supabase Auth)
ALTER TABLE game_hints DISABLE ROW LEVEL SECURITY;
ALTER TABLE round_secrets DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, use these permissive policies:
-- DROP POLICY IF EXISTS "Allow all on game_hints" ON game_hints;
-- CREATE POLICY "Allow all on game_hints" ON game_hints FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all on round_secrets" ON round_secrets;
-- CREATE POLICY "Allow all on round_secrets" ON round_secrets FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all on chat_messages" ON chat_messages;
-- CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
