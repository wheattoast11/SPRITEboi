import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PGlite } from '@electric-sql/pglite';
import { getDb, closeDb } from "./db";
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Create MCP server instance
export const server = new Server(
  {
    name: "Multimodal Generation Server",
    version: "1.0.0"
  },
  {
    capabilities: {
      logging: {},
      resources: {
        subscribe: true,
        listChanged: true
      },
      tools: {
        listChanged: true
      },
      prompts: {
        listChanged: true
      }
    },
    instructions: `
      This server provides multimodal generation capabilities:
      - Text-to-image generation with Janus Pro
      - Text-to-music generation with MusicGen
      - Database storage for generated content
      
      Available resources:
      - schema://database - Database schema information
      - table://{tableName} - Access to table data
      - media://generations - Access to generated media
      
      Available tools:
      - generate-image - Generate images using Janus Pro
      - generate-music - Generate music using MusicGen
      - store-generation - Store generated content in database
      
      Available prompts:
      - creative-prompt - Get help writing creative prompts
      - scene-description - Get help describing scenes
    `
  }
);
interface ModelContext {
  id: string;
  role: string;
  state: Map<string, any>;
  history: Array<{role: string, content: string}>;
  config: {
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
  };
}

class ModelContextManager {
  private contexts: Map<string, ModelContext>;
  private currentContext: string | null;
  
  constructor() {
    this.contexts = new Map();
    this.currentContext = null;
  }

  createContext(id: string, role: string, config?: Partial<ModelContext['config']>): ModelContext {
    const context: ModelContext = {
      id,
      role,
      state: new Map(),
      history: [],
      config: {
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 1000,
        stopSequences: config?.stopSequences ?? []
      }
    };
    this.contexts.set(id, context);
    return context;
  }

  async switchContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Save current context state if needed
    if (this.currentContext) {
      await this.saveContextState(this.currentContext);
    }
    
    // Load new context
    await this.loadContextState(contextId);
    this.currentContext = contextId;
  }

  private async saveContextState(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) return;

    // Save directly to PGlite
    const db = await getDb();
    await db.query(
      `INSERT INTO context_states (id, role, state, history, config)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         state = EXCLUDED.state,
         history = EXCLUDED.history,
         config = EXCLUDED.config`,
      [
        contextId,
        context.role,
        JSON.stringify(Object.fromEntries(context.state)),
        JSON.stringify(context.history),
        JSON.stringify(context.config)
      ]
    );
  }

  private async loadContextState(contextId: string): Promise<void> {
    const db = await getDb();
    const result = await db.query(
      'SELECT role, state, history, config FROM context_states WHERE id = $1',
      [contextId]
    );
    
    if (result.rows.length > 0) {
      const { role, state, history, config } = result.rows[0];
      const context = this.createContext(contextId, role, config);
      context.state = new Map(Object.entries(JSON.parse(state)));
      context.history = JSON.parse(history);
    }
    return context;
  }

  getCurrentContext(): ModelContext | null {
    return this.currentContext ? this.contexts.get(this.currentContext) || null : null;
  }

  async executeInContext<T>(contextId: string, action: () => Promise<T>): Promise<T> {
    const previousContext = this.currentContext;
    try {
      await this.switchContext(contextId);
      return await action();
    } finally {
      if (previousContext) {
        await this.switchContext(previousContext);
      }
    }
  }
}

class MCPToolRegistry {
  private tools: Map<string, {
    handler: (args: any) => Promise<any>;
    schema: z.ZodType<any>;
  }>;

  constructor() {
    this.tools = new Map();
  }

  register<T>(name: string, schema: z.ZodType<T>, handler: (args: T) => Promise<any>) {
    this.tools.set(name, { handler, schema });
  }

  async execute(name: string, args: any) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    const validatedArgs = tool.schema.parse(args);
    return await tool.handler(validatedArgs);
  }
}

// Initialize managers
export const contextManager = new ModelContextManager();
export const toolRegistry = new MCPToolRegistry();

// Register core tools
toolRegistry.register(
  'analyzeIntent',
  z.object({
    message: z.string(),
    context: z.string().optional(),
    availableTools: z.array(z.string())
  }),
  async ({ message, context, availableTools }) => {
    // Basic intent analysis
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('/imagine') || lowerMessage.includes('generate image')) {
      return { intent: 'generate', medium: 'image' };
    }
    
    if (lowerMessage.includes('/music') || lowerMessage.includes('generate music')) {
      return { intent: 'generate', medium: 'music' };
    }
    
    if (lowerMessage.includes('select') || lowerMessage.includes('show') || 
        lowerMessage.includes('find') || lowerMessage.includes('search')) {
      return { intent: 'query' };
    }
    
    return { intent: 'chat' };
  }
);

toolRegistry.register(
  'naturalToSql',
  z.object({
    natural: z.string(),
    context: z.string().optional()
  }),
  async ({ natural, context }) => {
    // Enhanced pattern matching for SQL generation
    const patterns = {
      'show all': 'SELECT * FROM generations ORDER BY created_at DESC',
      'latest': 'SELECT * FROM generations ORDER BY created_at DESC LIMIT 1',
      'images': "SELECT * FROM generations WHERE type = 'image'",
      'music': "SELECT * FROM generations WHERE type = 'music'",
      'sprites': "SELECT * FROM generations WHERE type = 'sprite_video'",
      'search': (term: string) => `SELECT * FROM generations WHERE prompt ILIKE '%${term}%'`,
      'before': (date: string) => `SELECT * FROM generations WHERE created_at < '${date}'`,
      'after': (date: string) => `SELECT * FROM generations WHERE created_at > '${date}'`
    };

    const lowerQuery = natural.toLowerCase();
    
    // Try to match patterns
    for (const [key, value] of Object.entries(patterns)) {
      if (lowerQuery.includes(key)) {
        if (typeof value === 'function') {
          // Extract search term or date
          const term = natural.split(key)[1].trim();
          return value(term);
        }
        return value;
      }
    }

    // Default to a simple search
    return `SELECT * FROM generations WHERE prompt ILIKE '%${natural}%'`;
  }
);

toolRegistry.register(
  'vectorSearch',
  z.object({
    embedding: z.array(z.number()),
    limit: z.number().optional(),
    threshold: z.number().optional()
  }),
  async ({ embedding, limit = 10, threshold = 0.8 }) => {
    const db = await getDb();
    const result = await db.query(
      `SELECT id, prompt, type, created_at, 
              1 - (vector <=> $1::vector) as similarity
       FROM generations 
       WHERE 1 - (vector <=> $1::vector) > $2
       ORDER BY similarity DESC
       LIMIT $3`,
      [embedding, threshold, limit]
    );
    return result.rows;
  }
);

toolRegistry.register(
  'hierarchicalQuery',
  z.object({
    path: z.string(),
    depth: z.number().optional()
  }),
  async ({ path, depth = 1 }) => {
    const db = await getDb();
    const result = await db.query(
      `WITH RECURSIVE tree AS (
         SELECT id, path, type, content, metadata, 1 as level
         FROM knowledge_nodes
         WHERE path ~ $1
         UNION ALL
         SELECT k.id, k.path, k.type, k.content, k.metadata, t.level + 1
         FROM knowledge_nodes k, tree t
         WHERE k.path ~ (t.path || '.*{1}')
         AND t.level < $2
       )
       SELECT * FROM tree ORDER BY path`,
      [path, depth]
    );
    return result.rows;
  }
);

toolRegistry.register(
  'switchContext',
  z.object({
    contextId: z.string(),
    role: z.string().optional()
  }),
  async ({ contextId, role }) => {
    if (role) {
      contextManager.createContext(contextId, role);
    }
    await contextManager.switchContext(contextId);
    return { success: true };
  }
);

toolRegistry.register(
  'executeQuery',
  z.object({
    query: z.string(),
    params: z.array(z.any()).optional()
  }),
  async ({ query, params = [] }) => {
    const db = await getDb();
    return await db.query(query, params);
  }
);

// Set up MCP request handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await toolRegistry.execute(
      request.params.name,
      request.params.arguments
    );
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: error.message }],
      isError: true
    };
  }
});

toolRegistry.register(
  'generateImage',
  z.object({
    prompt: z.string(),
    style: z.string().optional()
  }),
  async ({ prompt, style }) => {
    try {
      // Generate embedding for the prompt
      const embedding = await generateEmbedding(prompt);
      
      if (!imageWorker) {
        imageWorker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), { type: 'module' });
        imageWorker.postMessage({ type: 'load' });
      }

      const fullPrompt = style ? `${style} style: ${prompt}` : prompt;
      const result = await new Promise((resolve, reject) => {
        imageWorker.postMessage({ type: 'generate', prompt: fullPrompt });
        imageWorker.onmessage = (event) => {
          if (event.data.type === 'result') {
            resolve(event.data.image);
          } else if (event.data.type === 'error') {
            reject(event.data.error);
          }
        };
      });

      // Store in database
      const db = await getDb();
      await db.query(
        `INSERT INTO generations (type, prompt, content, embedding) 
         VALUES ($1, $2, $3, $4)`,
        ['image', fullPrompt, result, embedding]
      );

      return {
        type: 'image',
        data: result,
        metadata: { prompt: fullPrompt }
      };
    } catch (error) {
      console.error('Image generation error:', error);
      throw error;
    }
  }
);

toolRegistry.register(
  'searchGenerations',
  z.object({
    query: z.string()
  }),
  async ({ query }) => {
    try {
      // Use semantic search for natural language queries
      const results = await semanticSearch(db, query);

      return {
        content: results.map(row => ({
          type: row.type,
          data: row.content,
          metadata: {
            id: row.id,
            prompt: row.prompt,
            created_at: row.created_at,
            similarity: row.similarity,
            sprite_frames: row.sprite_frames,
            bpm: row.bpm
          }
        }))
      };
    } catch (error) {
      console.error('Search generations error:', error);
      throw error;
    }
  }
);