import { create } from 'zustand';
import { Clip, Layer, OutputConfig, ClipType, Slice } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  layers: Layer[];
  outputs: OutputConfig[];
  activeView: 'performance' | 'patch' | 'mapping';
  apiKey: string | null;
  
  // Actions
  setApiKey: (key: string) => void;
  setActiveView: (view: 'performance' | 'patch' | 'mapping') => void;
  triggerClip: (layerId: string, clipId: string) => void;
  updateParam: (clipId: string, paramId: string, value: number) => void;
  addClip: (layerId: string, clip: Clip) => void;
  updateSlice: (outputId: string, sliceId: string, points: {x:number, y:number}[]) => void;
}

const generateMockLayer = (id: string, name: string): Layer => ({
  id,
  name,
  opacity: 1.0,
  activeClipId: null,
  clips: Array.from({ length: 4 }).map((_, i) => ({
    id: `clip-${id}-${i}`,
    name: `Slot ${i + 1}`,
    type: ClipType.GENERATOR, // Default placeholder
    active: false,
    generatorId: 'empty',
    params: []
  }))
});

export const useStore = create<AppState>((set, get) => ({
  apiKey: process.env.GEMINI_API_KEY || null,
  activeView: 'performance',
  layers: [
    generateMockLayer('l1', 'Layer 1'),
    generateMockLayer('l2', 'Layer 2'),
    generateMockLayer('l3', 'Layer 3'),
  ],
  outputs: [{
    id: 'out1',
    name: 'Main Output',
    slices: [
      { id: 's1', name: 'Main Slice', active: true, points: [{x:0,y:0}, {x:1,y:0}, {x:1,y:1}, {x:0,y:1}] }
    ]
  }],

  setApiKey: (key) => set({ apiKey: key }),
  setActiveView: (view) => set({ activeView: view }),

  triggerClip: (layerId, clipId) => set((state) => ({
    layers: state.layers.map(l => {
      if (l.id !== layerId) return l;
      return {
        ...l,
        activeClipId: l.activeClipId === clipId ? null : clipId, // Toggle
        clips: l.clips.map(c => ({
            ...c,
            active: c.id === clipId ? !c.active : false
        }))
      };
    })
  })),

  updateParam: (clipId, paramId, value) => set((state) => ({
    layers: state.layers.map(l => ({
      ...l,
      clips: l.clips.map(c => {
        if (c.id !== clipId) return c;
        return {
          ...c,
          params: c.params.map(p => p.id === paramId ? { ...p, value } : p)
        };
      })
    }))
  })),

  addClip: (layerId, clip) => set((state) => ({
    layers: state.layers.map(l => {
        if (l.id !== layerId) return l;
        // Find first empty slot or append
        const emptyIdx = l.clips.findIndex(c => c.generatorId === 'empty');
        if (emptyIdx >= 0) {
            const newClips = [...l.clips];
            newClips[emptyIdx] = clip;
            return { ...l, clips: newClips };
        }
        return { ...l, clips: [...l.clips, clip] };
    })
  })),

  updateSlice: (outputId, sliceId, points) => set(state => ({
      outputs: state.outputs.map(o => {
          if (o.id !== outputId) return o;
          return {
              ...o,
              slices: o.slices.map(s => s.id === sliceId ? { ...s, points } : s)
          };
      })
  }))

}));
