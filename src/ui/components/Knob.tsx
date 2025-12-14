import React, { useRef, useState, useEffect } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
}

export const Knob: React.FC<KnobProps> = ({ value, min, max, onChange, label }) => {
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number>(0);
  const startVal = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dy = startY.current - e.clientY;
      const range = max - min;
      const delta = (dy / 200) * range; // Sensitivity
      const newVal = Math.min(max, Math.max(min, startVal.current + delta));
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.body.style.cursor = 'default';
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, max, min, onChange]);

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div 
        onMouseDown={handleMouseDown}
        className="w-12 h-12 rounded-full border-2 border-zinc-700 bg-zinc-900 relative cursor-ns-resize group hover:border-blue-500 transition-colors"
      >
        <div 
            className="absolute bottom-0 left-0 right-0 bg-blue-500/20 rounded-b-full overflow-hidden transition-all duration-75"
            style={{ height: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-zinc-400 group-hover:text-white">
          {value.toFixed(2)}
        </div>
      </div>
      <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">{label}</span>
    </div>
  );
};