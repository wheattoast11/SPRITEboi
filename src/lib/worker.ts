import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { vector } from '@electric-sql/pglite/vector';
import { live } from '@electric-sql/pglite/live';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

worker({
  async init() {
    try {
      return await PGlite.create({ 
        extensions: { vector, live, pg_trgm },
        wasmDirectory: '/node_modules/@electric-sql/pglite/dist/wasm/'
      });
    } catch (error) {
      console.error('Failed to initialize PGlite worker:', error);
      throw error;
    }
  }
});