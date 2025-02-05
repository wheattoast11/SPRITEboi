import { PGlite } from '@electric-sql/pglite';
import { PGliteWorker } from '@electric-sql/pglite/worker';
import { server } from "./mcp";
import { initializeSchema } from './db';
import PGWorker from './worker?worker&type=module';
import { contextManager } from './mcp';

let mcpWorker: PGliteWorker | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let isInitialized = false;
let leaderCheckInterval: number | null = null;

export async function startMcpServer(port: number = 3001) {
  if (isInitialized) {
    throw new Error("MCP server already started");
  }

  try {
    // Initialize PGlite worker with proper error handling
    mcpWorker = new PGliteWorker(
      new PGWorker()
    );

    // Wait for worker to be ready by querying
    await mcpWorker.query('SELECT 1');

    await initializeSchema(mcpWorker);

    // Initialize broadcast channel for cross-tab communication
    broadcastChannel = new BroadcastChannel('mcp-transport');
    isInitialized = true;
    
    // Set up leader election
    setupLeaderElection();

    // Handle broadcast messages
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'leader-change') {
          console.log(`Leader status changed: ${event.data.isLeader}`);
          if (event.data.isLeader) {
            startLeaderTasks();
          }
        }
      };
    }

    return () => {
      if (mcpWorker) {
        mcpWorker.close();
        mcpWorker = null;
        isInitialized = false;
      }
      if (broadcastChannel) {
        broadcastChannel.close();
        broadcastChannel = null;
      }
    };
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    throw new Error(`Failed to start MCP server: ${error.message}`);
  }
}

export function getMcpWorker() {
  if (!mcpWorker) {
    throw new Error('MCP worker not initialized');
  }
  return mcpWorker;
}

function setupLeaderElection() {
  if (!broadcastChannel) return;
  
  // Generate unique ID for this tab
  const tabId = crypto.randomUUID();
  let isLeader = false;
  
  // Broadcast heartbeat every 1 second if leader
  leaderCheckInterval = window.setInterval(() => {
    if (isLeader) {
      broadcastChannel?.postMessage({ type: 'heartbeat', tabId });
    }
  }, 1000);
  
  // Handle messages
  broadcastChannel.onmessage = (event) => {
    if (event.data.type === 'heartbeat') {
      if (event.data.tabId < tabId) {
        isLeader = false;
      } else if (!isLeader && event.data.tabId === tabId) {
        isLeader = true;
        startLeaderTasks();
      }
    }
  };
  
  // Initial leader check
  broadcastChannel.postMessage({ type: 'leader-check', tabId });
}

async function startLeaderTasks() {
  // Initialize default context if needed
  const defaultContext = await contextManager.getCurrentContext();
  if (!defaultContext) {
    await contextManager.createContext('default', 'chat');
  }
  
  // Start background sync
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('sync-generations');
    }
  }
}