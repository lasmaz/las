import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

const MiniVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    const render = () => {
      const analyser = audioEngine.getAnalyser();
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      
      // Screen Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; 
      ctx.fillRect(0, 0, width, height);

      if (!analyser) {
        // Flat line if offline - Subtle heartbeat
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
        ctx.stroke();
      } else {
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray); // Waveform data

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#22d3ee'; // Neon Cyan
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#22d3ee';
        ctx.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // Normalize to 0-2 range
          const y = v * height / 2; // Scale to canvas height

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="w-full max-w-2xl h-12 rounded-lg bg-black/80 border border-white/10 overflow-hidden flex items-center justify-center mx-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] relative group">
      {/* Screen Glare / Scanline effect for Retro/Pro look */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none z-10 opacity-60"></div>
      <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(34,211,238,0.05)] pointer-events-none z-10"></div>
      
      <canvas ref={canvasRef} width={600} height={64} className="w-full h-full relative z-0 opacity-90" />
    </div>
  );
};

export default MiniVisualizer;