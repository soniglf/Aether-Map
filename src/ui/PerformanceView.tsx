import React, { useState } from 'react';
import { useStore } from '../model/store';
import { Knob } from './components/Knob';
import { Play, Square, Video, Zap, Plus, Image as ImageIcon } from 'lucide-react';
import { ClipType } from '../../types';

export const PerformanceView: React.FC = () => {
  const { layers, triggerClip, updateParam, importMedia } = useStore();
  const [dragOverClip, setDragOverClip] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, clipId: string) => {
    e.preventDefault();
    setDragOverClip(clipId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverClip(null);
  };

  const handleDrop = async (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    setDragOverClip(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        // Import logic
        await importMedia(file, layerId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-4 gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-xl font-bold tracking-tight text-white/90">PERFORMANCE</h2>
            <div className="text-xs text-zinc-500 font-mono">BPM: 120.0</div>
        </div>

        {/* Layers */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2">
            {layers.map(layer => {
                const activeClip = layer.clips.find(c => c.id === layer.activeClipId);
                
                return (
                    <div key={layer.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex flex-row gap-4 h-56 transition-colors hover:border-zinc-700">
                        {/* Layer Controls */}
                        <div className="w-32 flex flex-col gap-2 border-r border-zinc-800 pr-4">
                            <span className="font-bold text-sm text-zinc-300 truncate">{layer.name}</span>
                            <div className="flex-1 bg-zinc-950 rounded relative overflow-hidden ring-1 ring-zinc-800">
                                <div className="absolute bottom-0 left-0 right-0 bg-blue-500/20" style={{height: `${layer.opacity * 100}%`}}></div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.01" 
                                    className="absolute inset-0 opacity-0 cursor-ns-resize"
                                    defaultValue={layer.opacity}
                                    title="Opacity"
                                />
                                <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-zinc-500 pointer-events-none">
                                    {Math.round(layer.opacity * 100)}%
                                </div>
                            </div>
                        </div>

                        {/* Clip Grid */}
                        <div className="flex-1 grid grid-cols-4 gap-2">
                            {layer.clips.map(clip => (
                                <div
                                    key={clip.id}
                                    onDragOver={(e) => handleDragOver(e, clip.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, layer.id)}
                                    onClick={() => clip.generatorId !== 'empty' && triggerClip(layer.id, clip.id)}
                                    className={`relative rounded-md flex flex-col items-center justify-center transition-all duration-100 group overflow-hidden cursor-pointer
                                        ${clip.active ? 'bg-blue-600/20 border-blue-400 ring-2 ring-blue-500/50' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750'}
                                        ${clip.generatorId === 'empty' ? 'opacity-50 border-dashed hover:opacity-100 hover:border-zinc-500' : 'border-solid'}
                                        ${dragOverClip === clip.id ? 'bg-green-900/50 border-green-400 scale-105' : ''}
                                    `}
                                >
                                    {clip.generatorId === 'empty' ? (
                                        <div className="flex flex-col items-center text-zinc-600 group-hover:text-zinc-400">
                                            <Plus size={24} />
                                            <span className="text-[10px] mt-1">DROP MEDIA</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-2 text-zinc-400 group-hover:text-white">
                                                {clip.type === ClipType.GENERATOR && <Zap size={24} />}
                                                {clip.type === ClipType.VIDEO && <Video size={24} />}
                                                {clip.type === ClipType.IMAGE && <ImageIcon size={24} />}
                                            </div>
                                            <span className="text-xs font-mono font-medium truncate w-full px-2 text-center text-zinc-300">
                                                {clip.name}
                                            </span>
                                            {clip.active && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                                            
                                            {/* Media Preview (Basic) */}
                                            {clip.sourceUrl && clip.type === ClipType.IMAGE && (
                                                <div className="absolute inset-0 -z-10 opacity-30 bg-cover bg-center" style={{backgroundImage: `url(${clip.sourceUrl})`}} />
                                            )}
                                            {clip.sourceUrl && clip.type === ClipType.VIDEO && (
                                                <video src={clip.sourceUrl} className="absolute inset-0 -z-10 w-full h-full object-cover opacity-30" />
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Active Clip Params */}
                        <div className="w-48 bg-zinc-950 rounded border border-zinc-800 p-3 flex flex-col gap-2 overflow-y-auto">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1 block">
                                PARAMETERS
                            </span>
                            <div className="flex flex-wrap content-start gap-3">
                                {activeClip && activeClip.params.length > 0 ? (
                                    activeClip.params.map(p => (
                                        <Knob 
                                            key={p.id}
                                            label={p.name}
                                            value={p.value}
                                            min={p.min}
                                            max={p.max}
                                            onChange={(v) => updateParam(activeClip.id, p.id, v)}
                                        />
                                    ))
                                ) : (
                                    <div className="text-zinc-700 text-xs text-center w-full py-4 italic">Select a clip</div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};
