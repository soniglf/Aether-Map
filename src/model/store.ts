import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Clip, Layer, OutputConfig, ClipType, Slice } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  layers: Layer[];
  outputs: OutputConfig[];
  activeView: 'performance' | 'patch' | 'mapping';
  apiKey: string | null;
  globalOpacity: number;
  
  // Actions
  setApiKey: (key: string) => void;
  setActiveView: (view: 'performance' | 'patch' | 'mapping') => void;
  triggerClip: (layerId: string, clipId: string) => void;
  updateParam: (clipId: string, paramId: string, value: number) => void;
  addClip: (layerId: string, clip: Clip) => void;
  importMedia: (file: File, layerId: string) => Promise<void>;
  updateSlice: (outputId: string, sliceId: string, points: {x:number, y:number}[]) => void;
  resetLayout: () => void;
}

const generateMockLayer = (id: string, name: string): Layer => ({
  id,
  name,
  opacity: 1.0,
  activeClipId: null,
  clips: Array.from({ length: 8 }).map((_, i) => ({
    id: `clip-${id}-${i}`,
    name: `Slot ${i + 1}`,
    type: ClipType.GENERATOR, 
    active: false,
    generatorId: 'empty', // Placeholder
    params: []
  }))
});

const DEFAULT_STATE = {
  activeView: 'performance' as const,
  globalOpacity: 1.0,
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
  }]
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      apiKey: process.env.GEMINI_API_KEY || null,
      ...DEFAULT_STATE,

      setApiKey: (key) => set({ apiKey: key }),
      setActiveView: (view) => set({ activeView: view }),
      resetLayout: () => set({ ...DEFAULT_STATE }),

      triggerClip: (layerId, clipId) => set((state) => ({
        layers: state.layers.map(l => {
          if (l.id !== layerId) return l;
          // Toggle logic: if clicking active, turn off. Else turn on.
          const isSame = l.activeClipId === clipId;
          const targetId = isSame ? null : clipId;
          
          return {
            ...l,
            activeClipId: targetId,
            clips: l.clips.map(c => ({
                ...c,
                active: c.id === targetId
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
            const emptyIdx = l.clips.findIndex(c => c.generatorId === 'empty');
            if (emptyIdx >= 0) {
                const newClips = [...l.clips];
                newClips[emptyIdx] = clip;
                return { ...l, clips: newClips };
            }
            return { ...l, clips: [...l.clips, clip] };
        })
      })),

      importMedia: async (file, layerId) => {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? ClipType.VIDEO : ClipType.IMAGE;
        
        const newClip: Clip = {
            id: uuidv4(),
            name: file.name,
            type,
            active: false,
            sourceUrl: url,
            params: [
                { id: uuidv4(), name: 'Opacity', value: 1.0, min: 0, max: 1 },
                { id: uuidv4(), name: 'Scale', value: 1.0, min: 0.1, max: 2.0 }
            ]
        };

        get().addClip(layerId, newClip);
      },

      updateSlice: (outputId, sliceId, points) => set(state => ({
          outputs: state.outputs.map(o => {
              if (o.id !== outputId) return o;
              return {
                  ...o,
                  slices: o.slices.map(s => s.id === sliceId ? { ...s, points } : s)
              };
          })
      }))
    }),
    {
      name: 'aether-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
         // Don't persist ephemeral blob URLs or API keys if we want security
         outputs: state.outputs,
         layers: state.layers.map(l => ({
             ...l,
             activeClipId: null, // Reset active on reload
             clips: l.clips.map(c => ({
                 ...c,
                 active: false,
                 // Note: Blob URLs will die on refresh. Real persistence needs IndexedDB.
                 // For MVP we keep structure but user must re-import assets or use generators.
                 sourceUrl: c.type === ClipType.GENERATOR ? undefined : '' 
             }))
         }))
      })
    }
  )
);
