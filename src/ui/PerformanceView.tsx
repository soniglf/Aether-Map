import React from 'react';
import { useStore } from '../model/store';
import { Knob } from './components/Knob';
import { Play, Square, Video, Zap } from 'lucide-react';
import { ClipType } from '../../types';

export const PerformanceView: React.FC = () => {
  const { layers, triggerClip, updateParam } = useStore();

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
                    <div key={layer.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex flex-row gap-4 h-48">
                        {/* Layer Controls */}
                        <div className="w-32 flex flex-col gap-2 border-r border-zinc-800 pr-4">
                            <span className="font-bold text-sm text-zinc-300 truncate">{layer.name}</span>
                            <div className="h-full bg-zinc-950 rounded relative overflow-hidden">
                                <div className="absolute bottom-0 left-0 right-0 bg-white/10" style={{height: `${layer.opacity * 100}%`}}></div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.01" 
                                    className="absolute inset-0 opacity-0 cursor-ns-resize"
                                    defaultValue={layer.opacity}
                                />
                            </div>
                        </div>

                        {/* Clip Grid */}
                        <div className="flex-1 grid grid-cols-4 gap-2">
                            {layer.clips.map(clip => (
                                <button
                                    key={clip.id}
                                    onClick={() => triggerClip(layer.id, clip.id)}
                                    className={`relative rounded-md flex flex-col items-center justify-center transition-all duration-100 group
                                        ${clip.active ? 'bg-blue-600 border-blue-400 ring-2 ring-blue-500/50' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}
                                        ${clip.generatorId === 'empty' ? 'opacity-30 border-dashed' : 'border-solid'}
                                    `}
                                >
                                    {clip.generatorId === 'empty' ? (
                                        <span className="text-zinc-600 text-xs">+</span>
                                    ) : (
                                        <>
                                            <div className="mb-2">
                                                {clip.type === ClipType.GENERATOR ? <Zap size={20} /> : <Video size={20} />}
                                            </div>
                                            <span className="text-xs font-mono font-medium truncate w-full px-2 text-center">{clip.name}</span>
                                            {clip.active && <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full animate-pulse" />}
                                        </>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Active Clip Params */}
                        <div className="w-64 bg-zinc-950 rounded border border-zinc-800 p-3 flex flex-wrap content-start gap-4 overflow-y-auto">
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
                                <div className="text-zinc-600 text-xs text-center w-full mt-10">No Active Clip</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};
