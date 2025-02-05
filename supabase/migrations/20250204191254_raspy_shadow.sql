/*
  # Add sprite video support

  1. Changes
    - Add sprite_frames and bpm columns to generations table
    - Add sprite_video type to type check constraint
    
  2. Notes
    - Maintains existing data
    - Adds new columns with defaults for backward compatibility
*/

-- Add new columns with defaults
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS sprite_frames INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS bpm INTEGER DEFAULT 120;

-- Update type check constraint to include sprite_video
DO $$ 
BEGIN
  ALTER TABLE generations 
    DROP CONSTRAINT IF EXISTS generations_type_check;
    
  ALTER TABLE generations
    ADD CONSTRAINT generations_type_check 
    CHECK (type IN ('image', 'music', 'sprite_video'));
END $$;