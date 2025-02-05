/*
  # Create generations table

  1. New Tables
    - `generations`
      - `id` (uuid, primary key)
      - `type` (text, check constraint for valid types)
      - `prompt` (text)
      - `content` (bytea for storing binary data)
      - `created_at` (timestamptz)
      - `sprite_frames` (integer, optional)
      - `bpm` (integer, optional)

  2. Security
    - Enable RLS on `generations` table
    - Add policies for authenticated users to manage their generations
*/

CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('image', 'music', 'sprite_video')),
  prompt TEXT NOT NULL,
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sprite_frames INTEGER DEFAULT 4,
  bpm INTEGER DEFAULT 120
);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own generations"
  ON generations
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);