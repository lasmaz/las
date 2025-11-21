import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const analyser = audioEngine.getAnalyser();

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);

      if (!analyser) {
        // Idle state
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animationId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Config
      const bars = 60; // Fewer, wider bars for modern look
      const barWidth = width / bars;
      const step = Math.floor(bufferLength / bars);

      for (let i = 0; i < bars; i++) {
        const dataIndex = i * step;
        const value = dataArray[dataIndex];
        
        // Non-linear scaling for better visualization
        const percent = value / 255;
        const barHeight = Math.pow(percent, 1.2) * (height / 2.5); 

        // Modern Gradient: Cyan to Indigo
        const hue = 190 + (percent * 60); 
        const saturation = 90;
        const lightness = 60;
        
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`;
        
        // Rounded Bars
        const x = i * barWidth + (barWidth * 0.1); // Slight gap
        const w = barWidth * 0.8;

        // Top
        roundRect(ctx, x, height / 2 - barHeight, w, barHeight, 3);
        ctx.fill();

        // Bottom (Reflection) - Lower opacity
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.15)`;
        roundRect(ctx, x, height / 2 + 2, w, barHeight * 0.6, 3);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Helper for rounded rectangles
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return (
    <div className="w-full h-40 rounded-2xl overflow-hidden relative group shadow-2xl">
        <div className="absolute inset-0 bg-[#0f0f11] border border-white/5 rounded-2xl"></div>
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        <canvas 
            ref={canvasRef} 
            width={1000} 
            height={300} 
            className="w-full h-full relative z-10"
        />
    </div>
  );
};

export default Visualizer;