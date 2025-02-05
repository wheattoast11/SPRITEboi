import React, { useRef, useEffect } from 'react';

interface SpriteCanvasProps {
  spriteImage: string;
  frames: number;
  bpm: number;
  audioRef?: React.RefObject<HTMLAudioElement>;
  width?: number;
  height?: number;
}

export function SpriteCanvas({ spriteImage, frames, bpm, audioRef, width = 384, height = 384 }: SpriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = spriteImage;
    
    img.onload = () => {
      const frameWidth = img.width / frames;
      const frameHeight = img.height;
      
      // Calculate frame timing based on BPM
      const msPerBeat = 60000 / bpm;
      const msPerFrame = msPerBeat / frames;

      const animate = (timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        
        const elapsed = timestamp - lastTimeRef.current;
        
        if (elapsed > msPerFrame) {
          // Clear canvas
          ctx.clearRect(0, 0, width, height);
          
          // Draw current frame
          ctx.drawImage(
            img,
            frameWidth * frameRef.current,
            0,
            frameWidth,
            frameHeight,
            0,
            0,
            width,
            height
          );
          
          // Update frame counter
          frameRef.current = (frameRef.current + 1) % frames;
          lastTimeRef.current = timestamp;
        }
        
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    };

    return () => {
      frameRef.current = 0;
      lastTimeRef.current = 0;
    };
  }, [spriteImage, frames, bpm, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg shadow-lg"
    />
  );
}