import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { vector } from '@electric-sql/pglite/vector';
import { live } from '@electric-sql/pglite/live';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { hstore } from '@electric-sql/pglite/contrib/hstore';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { lo } from '@electric-sql/pglite/contrib/lo';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch';

worker({
  id: 'pglite-main',
  async init() {
    try {
      // Create PGlite instance with all required extensions
      const db = await PGlite.create({
        extensions: { 
          vector, 
          live, 
          ltree,
          hstore,
          pg_trgm,
          fuzzystrmatch,
          uuid_ossp,
          lo
        },
        wasmDirectory: '/node_modules/@electric-sql/pglite/dist/wasm/'
      });

      // Initialize schema
      await db.query(`
        DO $$ 
        BEGIN
          -- Create generation type enum if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation_type') THEN
            CREATE TYPE generation_type AS ENUM ('image', 'music', 'sprite_video');
          END IF;

          -- Create generations table if it doesn't exist
          CREATE TABLE IF NOT EXISTS generations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type TEXT NOT NULL CHECK (type IN ('image', 'music', 'sprite_video')),
            prompt TEXT NOT NULL,
            content BYTEA NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            sprite_frames INTEGER DEFAULT 4,
            bpm INTEGER DEFAULT 120,
            metadata JSONB DEFAULT '{}'::jsonb
          );

          -- Create indexes if they don't exist
          CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);
          CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_generations_prompt_trgm ON generations USING gin(prompt gin_trgm_ops);
        END $$;
      `);

      // Verify database is working
      const result = await db.query('SELECT current_timestamp');
      console.log('PGlite initialized successfully:', result.rows[0]);
      
      return db;
    } catch (error) {
      console.error('Failed to initialize PGlite:', error);
      throw new Error(`PGlite initialization failed: ${error.message}`);
    }
  }
});