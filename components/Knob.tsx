import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  color?: string;
}

const Knob: React.FC<KnobProps> = ({ label, value, min, max, onChange, color = "cyan" }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      const range = max - min;
      const sensitivity = 200; 
      const deltaValue = (deltaY / sensitivity) * range;
      
      let newValue = startValue + deltaValue;
      newValue = Math.min(Math.max(newValue, min), max);
      
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, startY, startValue, min, max, onChange]);

  // SVG Calculations
  const percent = (value - min) / (max - min);
  const radius = 24;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - percent * circumference * 0.75; // 75% circle (270 deg)
  const rotationOffset = 135; // Start at bottom left

  // Palette
  const getColor = (type: 'main' | 'glow') => {
    const opacity = type === 'glow' ? '0.4' : '1';
    switch(color) {
      case 'rose': return `rgba(244, 63, 94, ${opacity})`;
      case 'indigo': return `rgba(129, 140, 248, ${opacity})`;
      case 'green': return `rgba(52, 211, 153, ${opacity})`;
      case 'cyan': return `rgba(34, 211, 238, ${opacity})`;
      default: return `rgba(34, 211, 238, ${opacity})`;
    }
  };
  
  const activeColor = getColor('main');
  const glowColor = getColor('glow');

  return (
    <div className="flex flex-col items-center gap-3 select-none knob-container group relative">
      <div 
        ref={knobRef}
        className="relative w-16 h-16 flex items-center justify-center cursor-ns-resize"
        onMouseDown={handleMouseDown}
      >
         {/* Background Glow */}
         <div 
            className="absolute inset-0 rounded-full transition-opacity duration-300"
            style={{ 
                background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                opacity: isDragging ? 0.4 : 0
            }}
         />

         {/* Value Display */}
         <div className="absolute z-10 flex flex-col items-center pointer-events-none">
            <span className={`font-mono text-[11px] font-bold tracking-tighter transition-colors duration-200 ${isDragging ? 'text-white' : 'text-zinc-400'}`}>
              {value.toFixed(value % 1 !== 0 ? 1 : 0)}
            </span>
         </div>

         {/* SVG Ring */}
         <svg className="absolute top-0 left-0 w-full h-full drop-shadow-md" viewBox="0 0 60 60">
            {/* Track */}
            <circle 
              cx="30" cy="30" r={radius} 
              fill="none" 
              stroke="#27272a" 
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              transform={`rotate(${rotationOffset} 30 30)`}
            />
            {/* Active Progress */}
            <circle 
              cx="30" cy="30" r={radius} 
              fill="none" 
              stroke={activeColor} 
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-75 ease-out"
              transform={`rotate(${rotationOffset} 30 30)`}
              filter="url(#glow)"
            />
            {/* Indicator Dot on Tip */}
             {/* Simple Glow Filter definition */}
             <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
         </svg>
      </div>
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">{label}</span>
    </div>
  );
};

export default Knob;