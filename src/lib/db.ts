import { PGlite } from '@electric-sql/pglite';
import { getMcpWorker } from './transport';

let dbInstance: PGlite | null = null;

export async function initializeSchema(db: PGlite) {
  try {
    // Verify connection
    await db.query('SELECT 1');
    
    // Enable required extensions
    await db.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE EXTENSION IF NOT EXISTS ltree;
      CREATE EXTENSION IF NOT EXISTS hstore;
      CREATE EXTENSION IF NOT EXISTS uuid_ossp;
      CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
    `);

    // Initialize schema
    await db.query(`
      DO $$ 
      BEGIN        
        -- Enable pg_trgm extension
        CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
          embedding vector(384),
          metadata JSONB DEFAULT '{}'::jsonb
        );

        -- Create context states table
        CREATE TABLE IF NOT EXISTS context_states (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          state JSONB NOT NULL,
          history JSONB NOT NULL,
          config JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        CREATE INDEX IF NOT EXISTS idx_context_states_role ON context_states(role);

        -- Create indexes if they don't exist
        CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);
        CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
        -- Create trigram index after extension is enabled
        CREATE INDEX IF NOT EXISTS idx_generations_prompt_trgm ON generations USING gin(prompt gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_generations_embedding ON generations USING ivfflat (embedding vector_cosine_ops);

        -- Create live query notification function
        CREATE OR REPLACE FUNCTION notify_generation()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify(
            'new_generation',
            json_build_object(
              'id', NEW.id,
              'type', NEW.type,
              'prompt', NEW.prompt,
              'created_at', NEW.created_at
            )::text
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger for live updates
        DROP TRIGGER IF EXISTS generation_notify_trigger ON generations;
        CREATE TRIGGER generation_notify_trigger
          AFTER INSERT ON generations
          FOR EACH ROW
          EXECUTE FUNCTION notify_generation();

        -- Create knowledge nodes table for hierarchical data
        CREATE TABLE IF NOT EXISTS knowledge_nodes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          path ltree NOT NULL,
          type text NOT NULL,
          content jsonb NOT NULL,
          vector vector(1536),
          metadata hstore,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        -- Create indexes for knowledge nodes
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_path ON knowledge_nodes USING gist(path);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_vector ON knowledge_nodes USING ivfflat (vector vector_cosine_ops);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_content ON knowledge_nodes USING gin(content);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_metadata ON knowledge_nodes USING gin(metadata);

        -- Create function to update timestamp
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS trigger AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger for timestamp updates
        DROP TRIGGER IF EXISTS update_knowledge_nodes_timestamp ON knowledge_nodes;
        CREATE TRIGGER update_knowledge_nodes_timestamp
          BEFORE UPDATE ON knowledge_nodes
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at();

      END $$;
    `);

    console.log('Schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize schema:', error);
    throw error;
  }
}

export async function getDb(): Promise<PGlite> {
  if (!dbInstance) {
    dbInstance = getMcpWorker();
  }
  return dbInstance;
}

export async function closeDb() {
  try {
    if (dbInstance) {
      await dbInstance.close();
      await dbInstance.query('UNLISTEN new_generation');
      dbInstance = null;
    }
  } catch (error) {
    // Worker already closed or not initialized
  }
}