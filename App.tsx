import React, { useEffect, useRef, useState } from 'react';
import { renderer } from './src/graphics/renderer';
import { useStore } from './src/model/store';
import { PerformanceView } from './src/ui/PerformanceView';
import { MappingView } from './src/ui/MappingView';
import { Copilot } from './src/ui/Copilot';
import { audioAnalyzer } from './src/media/audioAnalysis';
import { Grid, Monitor, Workflow, Activity, Database, Film } from 'lucide-react';
import { Telemetry } from './src/engine/telemetry';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeView, setActiveView } = useStore();
  const [telemetry, setTelemetry] = useState({ fps: 60, tex: 0, vid: 0 });

  useEffect(() => {
    if (containerRef.current) {
      renderer.init(containerRef.current);
      audioAnalyzer.init();
    }
    
    // Telemetry Poller
    const interval = setInterval(() => {
        const t = Telemetry.getInstance();
        setTelemetry({ fps: Math.round(t.fps), tex: t.activeTextures, vid: t.activeVideos });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden font-sans">
      {/* Top Bar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between z-20">
        <div className="flex items-center gap-4">
            <h1 className="font-bold tracking-widest text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">AETHER MAP</h1>
            <div className="flex bg-zinc-950 rounded p-1 gap-1">
                <button 
                    onClick={() => setActiveView('performance')}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-2 ${activeView === 'performance' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Grid size={14} /> PERFORMANCE
                </button>
                <button 
                    onClick={() => setActiveView('mapping')}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-2 ${activeView === 'mapping' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Monitor size={14} /> OUTPUT
                </button>
            </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
             <div className="flex items-center gap-1" title="Active Textures">
                <Database size={12} /> {telemetry.tex}
            </div>
             <div className="flex items-center gap-1" title="Active Videos">
                <Film size={12} /> {telemetry.vid}
            </div>
            <div className="flex items-center gap-1">
                <Activity size={12} className={telemetry.fps < 55 ? 'text-red-500' : 'text-green-500'} />
                {telemetry.fps} FPS
            </div>
            <div>GPU: PIXI 8 (WebGPU)</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Renderer Container (Background) */}
        <div 
            ref={containerRef} 
            className="absolute inset-0 z-0 opacity-100 pointer-events-none" 
            style={{ display: activeView === 'mapping' ? 'none' : 'block' }} 
        />

        {/* View Switcher */}
        <div className="flex-1 flex z-10 relative">
            {activeView === 'performance' && <PerformanceView />}
            {activeView === 'mapping' && <MappingView />}
        </div>

        {/* Right Sidebar (Copilot) */}
        <Copilot />
      </div>
    </div>
  );
}

export default App;
