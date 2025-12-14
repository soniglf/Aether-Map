import React from 'react';
import { useStore } from '../model/store';

export const MappingView: React.FC = () => {
  const { outputs, updateSlice } = useStore();
  const output = outputs[0];
  const slice = output.slices[0];

  const handleDrag = (idx: number, e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPoint = { ...slice.points[idx] };
    const container = e.currentTarget.parentElement?.getBoundingClientRect();

    if (!container) return;

    const onMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / container.width;
        const dy = (moveEvent.clientY - startY) / container.height;
        
        const newPoints = [...slice.points];
        newPoints[idx] = {
            x: Math.max(0, Math.min(1, startPoint.x + dx)),
            y: Math.max(0, Math.min(1, startPoint.y + dy))
        };
        updateSlice(output.id, slice.id, newPoints);
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="relative flex-1 bg-zinc-900 overflow-hidden flex items-center justify-center">
        <div className="absolute top-4 left-4 z-10 bg-black/80 p-4 rounded border border-zinc-700">
            <h3 className="font-bold text-white mb-2">OUTPUT 1</h3>
            <div className="text-xs text-zinc-400">Drag corners to warp.</div>
            <div className="mt-2 text-xs text-zinc-500">Slice: {slice.name}</div>
        </div>

        {/* CSS Representation of the Slice for UI interaction */}
        {/* Note: The actual warp happens in the Renderer, this is just the UI Editor Overlay */}
        <div className="relative w-[640px] h-[360px] bg-zinc-800 border border-dashed border-zinc-600">
             {/* Render Lines */}
             <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon 
                    points={slice.points.map(p => `${p.x * 640},${p.y * 360}`).join(' ')}
                    fill="rgba(0, 255, 0, 0.1)"
                    stroke="#00ff00"
                    strokeWidth="2"
                />
             </svg>

             {/* Handles */}
             {slice.points.map((p, i) => (
                 <div
                    key={i}
                    onMouseDown={(e) => handleDrag(i, e)}
                    className="absolute w-4 h-4 bg-white border-2 border-green-500 rounded-full cursor-move hover:scale-125 transition-transform"
                    style={{
                        left: `${p.x * 100}%`,
                        top: `${p.y * 100}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                 />
             ))}
        </div>
    </div>
  );
};