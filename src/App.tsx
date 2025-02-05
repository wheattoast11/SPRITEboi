import React, { useState, useEffect } from 'react';
import { DatabaseRepl } from './components/DatabaseRepl';
import { MediaGeneration } from './components/MediaGeneration';
import { GenerationGallery } from './components/GenerationGallery';
import { server } from './lib/mcp';
import type { Generation } from './types';
import { getDb, closeDb } from './lib/db';
import { startMcpServer } from './lib/transport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useApp } from './contexts/AppContext';

function App() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useApp();

  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        
        // Start MCP server
        await startMcpServer();
        
        // Load initial data
        await loadGenerations();
        setError(null);
      } catch (error) {
        console.error('Failed to initialize:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize application';
        setError(errorMessage);
        // Only retry if not already retrying
        if (!isInitializing) {
          const retryTimer = setTimeout(() => init(), 2000);
          return () => clearTimeout(retryTimer);
          await closeDb();
        }
      } finally {
        setIsInitializing(false);
      }
    };
    
    init();
    
    // Cleanup on unmount
    return () => {
      setIsInitializing(false);
      server.close();
    };
  }, []);

  const loadGenerations = async () => {
    const db = await getDb();
    const result = await db.query(
      // Use semantic search if search term exists
      'SELECT * FROM generations ORDER BY created_at DESC'
    );
    setGenerations(result.rows);
  };

  const handleGenerateImage = async (prompt: string, style?: string) => {
    const result = await server.tools.generateImage.execute({ prompt, style });
    dispatch({ type: 'SET_ERROR', payload: null });
    await loadGenerations();
  };

  const handleGenerateMusic = async (prompt: string, duration: number) => {
    const result = await server.tools.generateMusic.execute({ 
      prompt, duration 
    });
    dispatch({ type: 'SET_ERROR', payload: null });
    await loadGenerations();
  };

  const handleExport = async (generation: Generation) => {
    const blob = new Blob([generation.content], {
      type: generation.type === 'image' ? 'image/png' : 'audio/wav'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generation-${generation.id}.${generation.type === 'image' ? 'png' : 'wav'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-4xl p-8">
        {isInitializing && (
          <div className="text-center text-muted-foreground cypher-text animate-pulse">
            Initializing system...
          </div>
        )}
        
        {error && !isInitializing && (
          <div className="text-center text-red-400 bg-red-950/20 p-4 rounded-lg border border-red-500/20 cypher-text">
            {error}
          </div>
        )}
        
        {!isInitializing && (
          <>
          <div className="header-container mb-8">
            <div className="relative z-10">
              <h1 className="text-4xl cypher-text title-glow text-center mb-2">
                <span className="typewriter inline-block">S P R I T E</span>
              </h1>
              <p className="text-sm text-center text-primary/80 cypher-text">
                Synthetic Processing & Rendering Interface for Text Expressions
              </p>
            </div>
            <div className="absolute inset-0 gradient-glow -z-10"></div>
          </div>
          
          <div className="mb-8">
            <MediaGeneration
              onGenerateImage={handleGenerateImage}
              onGenerateMusic={handleGenerateMusic}
              onExportMedia={handleExport}
            />
          </div>
          
          <div className="mb-8">
            <GenerationGallery
              generations={generations}
              onRefresh={loadGenerations}
              onExport={handleExport}
            />
          </div>
          
          <DatabaseRepl />
          </>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default function AppWrapper() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}