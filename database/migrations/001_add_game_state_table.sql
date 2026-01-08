-- Migration 001: Add game_state table (server-only)
-- This table stores sensitive game data that clients should never see

CREATE TABLE IF NOT EXISTS public.game_state (
  room_id uuid PRIMARY KEY REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  traitor_user_id uuid REFERENCES public.profiles(id),
  current_word_pair_id uuid REFERENCES public.word_pairs(id),
  phase_started_at timestamptz,
  game_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS) to prevent client access
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

-- Deny all client access (only backend service role can access)
CREATE POLICY "No client access to game_state"
  ON public.game_state
  FOR ALL
  USING (false);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_game_state_room_id ON public.game_state(room_id);

COMMENT ON TABLE public.game_state IS 'Server-only game state - contains sensitive data like traitor identity';