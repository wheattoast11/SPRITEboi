import React from 'react';
import { Download, Search, RefreshCw } from 'lucide-react';
import type { Generation } from '../types';
import { useApp } from '../contexts/AppContext';

interface GenerationGalleryProps {
  generations: Generation[];
  onExport: (generation: Generation) => void;
  onRefresh?: () => void;
}

import { debouncedSearch } from '../lib/utils';

export function GenerationGallery({ generations, onExport, onRefresh }: GenerationGalleryProps) {
  const { state } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Generation[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const initSearch = async () => {
      const db = await getDb();
      if (isMounted) {
        debouncedSearch(searchTerm, db, setSemanticResults, setIsSearching);
      }
    };
    
    initSearch();
    
    return () => {
      isMounted = false;
      debouncedSearch.cancel();
    };
    return () => debouncedSearch.cancel();
  }, [searchTerm]);


  if (generations.length === 0) {
    return (
      <div className="text-muted-foreground cypher-text text-center p-8">
        No generations yet. Start creating!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search generations..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border-border/50 rounded-lg text-foreground input-glow transition-shadow"
          />
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            title="Refresh generations"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>

      {state.generationQueue.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Processing {state.generationQueue.length} items...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {(semanticResults.length > 0 ? semanticResults : generations).map((generation) => (
        <div key={generation.id} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-end justify-between p-4">
            <div className="text-white cypher-text text-sm truncate">
              {generation.prompt}
              {generation.similarity && (
                <span className="ml-2 text-xs opacity-75">
                  ({(generation.similarity * 100).toFixed(1)}% match)
                </span>
              )}
            </div>
            <button
              onClick={() => onExport(generation)}
              className="bg-primary/90 hover:bg-primary text-primary-foreground p-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          {generation.type === 'image' ? (
            <img
              src={URL.createObjectURL(new Blob([generation.content]))}
              alt={generation.prompt}
              className="w-full aspect-square object-cover rounded-lg"
            />
          ) : generation.type === 'sprite_video' ? (
            <div className="w-full aspect-square bg-card rounded-lg flex items-center justify-center">
              <div className="text-muted-foreground cypher-text">Sprite Video</div>
            </div>
          ) : (
            <div className="w-full aspect-square bg-card rounded-lg flex items-center justify-center">
              <div className="text-muted-foreground cypher-text">Audio</div>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}