import React, { useState } from 'react';
import { Play, Pause, Image, Music, Film, Download } from 'lucide-react';

interface MediaGenerationProps {
  onGenerateImage: (prompt: string, style?: string) => Promise<void>;
  onGenerateMusic: (prompt: string, duration: number) => Promise<void>;
  onExportMedia?: (type: string, id: string) => Promise<void>;
}

export function MediaGeneration({ onGenerateImage, onGenerateMusic, onExportMedia }: MediaGenerationProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [duration, setDuration] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'music' | 'sprite'>('image');
  const [spriteFrames, setSpriteFrames] = useState(4);
  const [bpm, setBpm] = useState(120);
  const [searchResults, setSearchResults] = useState<Generation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { state, addToQueue, updateQueueStatus } = useApp();

  const handleGenerateImage = async (prompt: string, style?: string) => {
    try {
      setIsGenerating(true);
      const result = await server.tools.generateImage.execute({ prompt, style });
      
      if (activeTab === 'sprite') {
        try {
          const { masks, scores } = await segmentImageWithCache(result.content, result.id);
          const bestMaskIndex = scores.indexOf(Math.max(...scores));
          const spriteMask = masks[bestMaskIndex];
          result.content = applyMask(result.content, spriteMask);
        } catch (error) {
          console.error('Segmentation failed:', error);
          // Continue with unsegmented image
        }
      }
      
      dispatch({ type: 'SET_ERROR', payload: null });
      await loadGenerations();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      const id = crypto.randomUUID();
      addToQueue(activeTab, id);
      
      if (activeTab === 'image') {
        await onGenerateImage(prompt, style);
        updateQueueStatus(id, 'complete');
      } else if (activeTab === 'sprite') {
        // Generate both sprite sheet and music in sequence
        const spritePrompt = `${prompt} as a sprite sheet with ${spriteFrames} frames, pixel art style`;
        await onGenerateImage(spritePrompt, 'pixel art');
        
        const musicPrompt = `${prompt}, electronic music at ${bpm} BPM`;
        await onGenerateMusic(musicPrompt, duration);
        updateQueueStatus(id, 'complete');
      } else {
        await onGenerateMusic(prompt, duration);
        updateQueueStatus(id, 'complete');
      }
    } catch (error) {
      updateQueueStatus(id, 'failed');
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearch = async (searchTerm: string) => {
    setIsSearching(true);
    try {
      const results = await server.tools.searchGenerations.execute({
        query: searchTerm
      });
      setSearchResults(results.content);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-card rounded-lg shadow-xl p-6 border border-border/50 relative overflow-hidden">
      <div className="absolute inset-0 gradient-glow"></div>
      <div className="relative z-10">
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex items-center px-4 py-2 rounded-lg ${
            activeTab === 'image'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <Image className="w-5 h-5 mr-2" />
          Image
        </button>
        <button
          onClick={() => setActiveTab('music')}
          className={`flex items-center px-4 py-2 rounded-lg ${
            activeTab === 'music'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <Music className="w-5 h-5 mr-2" />
          Music
        </button>
        <button
          onClick={() => setActiveTab('sprite')}
          className={`flex items-center px-4 py-2 rounded-lg ${
            activeTab === 'sprite'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <Film className="w-5 h-5 mr-2" />
          Sprite Video
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground/90 mb-1 cypher-text">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-3 py-2 bg-secondary border-border/50 rounded-lg text-foreground input-glow transition-shadow"
            rows={3}
            placeholder={activeTab === 'image' ? 
              "Describe the image you want to create (e.g., 'a cyberpunk cityscape at night')..." :
              activeTab === 'music' ?
              "Describe the music you want to generate (e.g., 'ambient electronic with deep bass')..." :
              "Describe your audio-visual scene (e.g., 'a glowing crystal rotating in space')..."
            }
            required
          />
        </div>

        {(activeTab === 'image' || activeTab === 'sprite') && (
          <div>
            <label className="block text-sm font-medium text-foreground/90 mb-1 cypher-text">
              Style (optional)
            </label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border-border/50 rounded-lg text-foreground input-glow transition-shadow"
              placeholder={activeTab === 'sprite' ? 'Additional style details (pixel art style is default)' : 'e.g., watercolor, pixel art, photorealistic'}
            />
          </div>
        )}

        {(activeTab === 'music' || activeTab === 'sprite') && (
          <div>
            <label className="block text-sm font-medium text-foreground/90 mb-1 cypher-text">
              Duration (seconds)
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:slider-track [&::-webkit-slider-thumb]:slider-thumb"
            />
            <div className="text-sm text-muted-foreground mt-1 cypher-text">
              {duration} seconds
            </div>
          </div>
        )}

        {activeTab === 'sprite' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sprite Frames
              </label>
              <input
                type="range"
                min="2"
                max="8"
                value={spriteFrames}
                onChange={(e) => setSpriteFrames(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {spriteFrames} frames
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Music BPM
              </label>
              <input
                type="range"
                min="60"
                max="180"
                step="1"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {bpm} BPM
              </div>
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={isGenerating}
          className={`w-full py-2 px-4 rounded-lg flex items-center justify-center ${
            isGenerating
              ? 'bg-muted cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90'
          } text-primary-foreground font-medium transition-colors cypher-text`}
        >
          {isGenerating ? (
            <>
              <Pause className="w-5 h-5 mr-2 animate-pulse" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Generate {activeTab === 'image' ? 'Image' : activeTab === 'music' ? 'Music' : 'Sprite Video'}
            </>
          )}
        </button>
        
        {onExportMedia && (
          <button
            onClick={() => onExportMedia(activeTab, 'latest')}
            className="w-full py-2 px-4 rounded-lg flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors cypher-text"
          >
            <Download className="w-5 h-5 mr-2" />
            Export
          </button>
        )}
      </form>
      </div>
    </div>
  );
}