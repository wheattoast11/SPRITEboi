import { useEffect, useState, useCallback } from 'react';
import { Repl, ReplOutput } from '@electric-sql/pglite-repl';
import { getDb } from '../lib/db';
import type { PGlite } from '@electric-sql/pglite';
import { Terminal, Search, X, MessageSquare, Database } from 'lucide-react';
import type { DatabaseQuery } from '../types';
import { server } from '../lib/mcp';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useRef } from 'react';

export function DatabaseRepl() {
  const [db, setDb] = useState<PGlite | null>(null);
  const [history, setHistory] = useState<ReplOutput[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [naturalQuery, setNaturalQuery] = useState('');
  const [mode, setMode] = useState<'sql' | 'chat'>('sql');
  const replContainerRef = useRef<HTMLDivElement>(null);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
  }>>([]);
  const [key, setKey] = useState(0);

  // Force re-render of REPL when expanding
  useEffect(() => {
    if (isExpanded) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setKey(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const handleNaturalQuery = async (query: string) => {
    if (!db) return;
    
    try {
      // Convert natural language to SQL using pattern matching
      const sqlQuery = await generateSqlQuery(query);
      const result = await db.query(sqlQuery);
      
      setHistory(prev => [...prev, {
        type: 'natural',
        content: query,
        result: result.rows
      }]);
    } catch (error) {
      console.error('Query error:', error);
      setHistory(prev => [...prev, {
        type: 'error',
        content: error.message
      }]);
    }
  };

  const handleMessage = async (message: string) => {
    if (mode === 'chat') {
      const context = await contextManager.getCurrentContext();
      if (!context) {
        await contextManager.createContext('default', 'chat');
      }
      return handleChat(message, context);
    } else {
      return handleSqlQuery(message);
    }
  };

  const handleSqlQuery = async (query: string) => {
    if (!db) return;
    
    try {
      const result = await db.query(query);
      setHistory(prev => [...prev, {
        type: 'sql',
        content: query,
        result: result.rows
      }]);
    } catch (error) {
      console.error('Query error:', error);
      setHistory(prev => [...prev, {
        type: 'error',
        content: error.message
      }]);
    }
  };

  const handleChat = async (message: string, context: ModelContext | null) => {
    try {
      setChatHistory(prev => [...prev, { role: 'user', content: message }]);

      // Analyze message intent
      const analysis = await server.tools.analyzeIntent.execute({
        message,
        context: context?.id,
        availableTools: ['generateImage', 'generateMusic', 'executeQuery']
      });

      let response;
      if (analysis.intent === 'query') {
        // Convert natural language to SQL
        const sqlQuery = await server.tools.naturalToSql.execute({
          natural: message,
          context: context?.id
        });
        response = await handleSqlQuery(sqlQuery);
      } else if (analysis.intent === 'generate') {
        if (analysis.medium === 'image') {
          const imageResult = await server.tools.generateImage.execute({
            prompt: message,
            context: context?.id
          });
          response = '🎨 Generated image based on your prompt. You can find it in the gallery above.';
        } else if (analysis.medium === 'music') {
          const musicResult = await server.tools.generateMusic.execute({
            prompt: message,
            duration: 10,
            context: context?.id
          });
          response = '🎵 Generated music based on your prompt. You can find it in the gallery above.';
        }
      } else {
        // Use Janus Pro for chat analysis and response
        const analysis = await server.tools.generateImage.execute({
          prompt: `Analyze and respond to this message as a helpful AI assistant: ${message}`,
          context: context?.id
        });
        response = analysis.content[0].text;
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
      
      // Update context history
      if (context) {
        context.history.push(
          { role: 'user', content: message },
          { role: 'assistant', content: response }
        );
        await contextManager.saveContextState(context.id);
      }
      
      scrollToBottom();
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an error: ${error.message}`
      }]);
    }
  };

  const scrollToBottom = () => {
    if (replContainerRef.current) {
      replContainerRef.current.scrollTop = replContainerRef.current.scrollHeight;
    }
  };

  const generateSqlQuery = async (natural: string): Promise<string> => {
    // Simple pattern matching for common queries
    const patterns = {
      'show all': 'SELECT * FROM generations ORDER BY created_at DESC',
      'latest': 'SELECT * FROM generations ORDER BY created_at DESC LIMIT 1',
      'images': "SELECT * FROM generations WHERE type = 'image'",
      'music': "SELECT * FROM generations WHERE type = 'music'",
      'sprites': "SELECT * FROM generations WHERE type = 'sprite_video'",
    };

    const match = Object.entries(patterns).find(([key]) => 
      natural.toLowerCase().includes(key)
    );

    return match ? match[1] : 'SELECT * FROM generations WHERE prompt ILIKE $1';
  };

  useEffect(() => {
    getDb()
      .then(setDb)
      .catch(error => {
        console.error('Failed to initialize database:', error);
      });
  }, []);

  if (!db) {
    return (
      <div className="p-4 text-gray-600">
        <div className="p-4 text-muted-foreground cypher-text">
          Initializing database...
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 right-0 w-full md:w-[600px] transition-all duration-300 ease-in-out ${isExpanded ? 'h-[400px]' : 'h-12'} z-[100] shadow-xl`}>
      <div
        role="button"
        tabIndex={0}
        className="sticky top-0 left-0 right-0 h-12 console-header flex items-center px-4 cursor-pointer hover:bg-card/95 transition-colors group z-[101] gap-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded(!isExpanded);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}>
        <Terminal className="w-5 h-5" />
        <span className="cypher-text text-foreground">
          Interactive Console
          <span className="ml-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </span>
        {isExpanded && (
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex rounded-lg overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('sql');
                }} 
                className={`console-tab ${mode === 'sql' ? 'active' : ''}`}
              >
                <Database className="w-4 h-4 mr-2" />
                SQL
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('chat');
                }}
                className={`console-tab ${mode === 'chat' ? 'active' : ''}`}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      
      <div 
        className={`w-full h-full console-body transition-all ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto relative">
        {mode === 'sql' ? (
          <Repl 
            key={`sql-${key}`}
            pg={db}
            className="repl-container absolute inset-0"
            containerRef={replContainerRef}
            theme={{
              background: 'hsl(var(--background))',
              foreground: 'hsl(var(--foreground))',
              cursor: 'hsl(var(--primary))',
              selection: 'hsla(var(--primary), 0.15)',
              black: 'hsl(var(--muted))',
              brightBlack: 'hsl(var(--muted-foreground))',
              red: 'hsl(0 90% 65%)',
              brightRed: 'hsl(0 90% 75%)',
              green: 'hsl(120 60% 65%)',
              brightGreen: 'hsl(120 60% 75%)',
              yellow: 'hsl(60 70% 65%)',
              brightYellow: 'hsl(60 70% 75%)',
              blue: 'hsl(210 90% 65%)',
              brightBlue: 'hsl(210 90% 75%)',
              magenta: 'hsl(300 90% 65%)',
              brightMagenta: 'hsl(300 90% 75%)',
              cyan: 'hsl(180 90% 65%)',
              brightCyan: 'hsl(180 90% 75%)',
              white: 'hsl(var(--foreground))',
              brightWhite: 'hsl(var(--foreground))'
            }}
            onOutput={(output) => {
              setHistory(prev => [...prev, output]);
            }}
            options={{
              viewportMargin: Infinity,
              lineNumbers: true,
              mode: 'sql',
              placeholder: mode === 'sql' ? 'Enter SQL query...' : 'Chat with the assistant...'
            }}
            onExecute={async (query) => {
              if (mode === 'chat') {
                await handleChat(query);
                return { rows: [] };
              }
              return db.query(query);
            }}
          />
        ) : (
          <>
            <div className="p-4 space-y-4">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'assistant'
                      ? 'bg-secondary/80 text-secondary-foreground backdrop-blur-sm'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(marked(msg.content))
                    }}
                  />
                </div>
              </div>
            ))}
            </div>
          </>
        )}
        </div>
        <div className={`flex-shrink-0 ${mode !== 'chat' ? 'hidden' : ''}`}>
            <Repl
              key={`chat-${key}`}
              pg={db}
              className="repl-container min-h-[48px]"
              containerRef={replContainerRef}
              theme={{
                // ... same theme as SQL mode
              }}
              options={{
                viewportMargin: Infinity,
                lineNumbers: false,
                mode: 'text',
                placeholder: 'Type your message...'
              }}
              onExecute={async (message) => {
                await handleChat(message);
                return { rows: [] };
              }}
            />
          </div>
      </div>
    </div>
  );
}