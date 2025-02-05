export interface Generation {
  id: string;
  type: 'image' | 'music' | 'sprite_video';
  prompt: string;
  content: Uint8Array;
  created_at: string;
  sprite_frames?: number;
  bpm?: number;
  similarity?: number;
  objects?: Array<{
    mask: Uint8Array;
    score: number;
  }>;
}

export interface DatabaseQuery {
  type: 'natural' | 'sql';
  content: string;