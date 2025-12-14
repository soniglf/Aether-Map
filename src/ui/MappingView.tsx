import React from 'react';
import { useStore } from '../model/store';
import { Maximize, Save, RefreshCw } from 'lucide-react';

export const MappingView: React.FC = () => {
  const { outputs, updateSlice, resetLayout } = useStore();
  const output = outputs[0];
  const slice = output.slices[0];

  const handleDrag = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
      } else {
          document.exitFullscreen();
      }
  };

  return (
    <div className="relative flex-1 bg-zinc-900 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="h-10 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 gap-2">
            <span className="text-xs font-bold text-zinc-400 mr-4">OUTPUT 1 / SLICE 1</span>
            
            <button className="text-zinc-400 hover:text-white p-1" title="Fullscreen" onClick={toggleFullscreen}>
                <Maximize size={16} />
            </button>
             <button className="text-zinc-400 hover:text-white p-1" title="Reset Layout" onClick={resetLayout}>
                <RefreshCw size={16} />
            </button>
            <div className="flex-1" />
            <button className="text-zinc-400 hover:text-white p-1" title="Save Preset (Auto-saved)">
                <Save size={16} />
            </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative flex items-center justify-center bg-zinc-900/50">
             <div className="absolute top-4 left-4 z-10 bg-black/80 p-3 rounded border border-zinc-700 pointer-events-none">
                <h3 className="font-bold text-white text-sm">Calibration Mode</h3>
                <div className="text-[10px] text-zinc-400 mt-1">Drag green handles to warp output.</div>
             </div>

            {/* Container representing the physical screen aspect ratio (16:9 approx for demo) */}
            <div className="relative w-[80%] aspect-video bg-black border border-zinc-700 shadow-2xl">
                 
                 {/* This area represents the Full Screen Output */}
                 
                 {/* Slice Outline Visualization */}
                 <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <polygon 
                        points={slice.points.map(p => `${p.x * 100}% ,${p.y * 100}%`).join(' ')}
                        fill="rgba(0, 255, 0, 0.05)"
                        stroke="#00ff00"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                    />
                 </svg>

                 {/* Interactive Handles */}
                 {slice.points.map((p, i) => (
                     <div
                        key={i}
                        onMouseDown={(e) => handleDrag(i, e)}
                        className="absolute w-6 h-6 bg-transparent flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform group"
                        style={{
                            left: `${p.x * 100}%`,
                            top: `${p.y * 100}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                     >
                         <div className="w-3 h-3 bg-black border-2 border-green-500 rounded-full group-hover:bg-green-500" />
                         <div className="absolute -top-6 text-[10px] font-mono text-green-500 opacity-0 group-hover:opacity-100 bg-black px-1 rounded">
                             {i}
                         </div>
                     </div>
                 ))}
            </div>
        </div>
    </div>
  );
};
