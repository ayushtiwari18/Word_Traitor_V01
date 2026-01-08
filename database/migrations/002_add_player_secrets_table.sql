-- Migration 002: Add player_secrets table (server-only)
-- This table stores individual player roles and secret words per round

CREATE TABLE IF NOT EXISTS public.player_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  round_number integer NOT NULL,
  role text NOT NULL CHECK (role IN ('traitor', 'civilian')),
  secret_word text NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(room_id, user_id, round_number)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;

-- Deny all client access (only backend can read/write)
CREATE POLICY "No client access to player_secrets"
  ON public.player_secrets
  FOR ALL
  USING (false);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_secrets_room_round ON public.player_secrets(room_id, round_number);
CREATE INDEX IF NOT EXISTS idx_player_secrets_user_room ON public.player_secrets(user_id, room_id);

COMMENT ON TABLE public.player_secrets IS 'Server-only player secrets - roles and words per round';