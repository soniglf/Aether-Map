import { Application, Container, Graphics, Shader, Mesh, Geometry } from 'pixi.js';
import { useStore } from '../model/store';
import { BASIC_VERTEX, FEEDBACK_SMOKE_FRAG } from './shaders/generators';
import { audioAnalyzer } from '../media/audioAnalysis';
import { Telemetry } from '../engine/telemetry';

class AetherRenderer {
  app: Application | null = null;
  container: Container;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private generatorMeshes: Map<string, Mesh> = new Map();
  private sliceGraphics: Graphics;
  
  constructor() {
    this.container = new Container();
    this.sliceGraphics = new Graphics();
  }

  async init(container: HTMLElement) {
    // 1. Guard: If already initializing or initialized
    if (this.initPromise) {
        await this.initPromise;
        // Re-attach canvas if needed (React remount)
        if (this.app?.canvas && !container.contains(this.app.canvas as unknown as Node)) {
            container.appendChild(this.app.canvas as unknown as Node);
        }
        return;
    }

    // 2. Start Initialization
    this.initPromise = (async () => {
        try {
            // Lazy instantiation to avoid side-effects until needed
            if (!this.app) {
                this.app = new Application();
            }

            // Init Pixi Application
            // We use specific options to ensure stability
            await this.app.init({
                resizeTo: window,
                preference: 'webgpu',
                background: '#000000',
                antialias: true,
                hello: true // nice to have in console to confirm version
            });

            // Append Canvas
            if (this.app.canvas) {
                container.appendChild(this.app.canvas as unknown as Node);
            }

            // Setup Stage
            this.app.stage.addChild(this.container);
            this.app.stage.addChild(this.sliceGraphics);
            
            // Start Render Loop
            this.app.ticker.add((ticker) => {
                this.render(ticker.deltaTime);
            });

            this.initialized = true;
            console.log("Aether Engine Initialized (Pixi 8)");

        } catch (e: any) {
            console.error("Renderer Init Failed:", e);
            
            // If the error is the specific batcher handler issue, it implies global state conflict.
            // We can't easily recover the *current* app, but we can reset the promise to allow retry.
            this.initPromise = null;
            
            // If we partially created the app, destroy it
            if (this.app) {
                try { await this.app.destroy(); } catch {}
                this.app = null;
            }
            throw e;
        }
    })();

    return this.initPromise;
  }

  private createGeneratorMesh(type: string): Mesh {
     const geometry = new Geometry({
         attributes: {
             aPosition: [-1, -1, 1, -1, 1, 1, -1, 1],
             aUV: [0, 0, 1, 0, 1, 1, 0, 1]
         },
         indexBuffer: [0, 1, 2, 0, 2, 3]
     });

     let shader;
     // Note: Pixi 8 Shader.from handles GLSL/WGSL conversion automatically in many cases
     if (type === 'smoke') {
         shader = Shader.from({
             gl: { vertex: BASIC_VERTEX, fragment: FEEDBACK_SMOKE_FRAG },
             gpu: { vertex: { entryPoint: 'main', source: BASIC_VERTEX }, fragment: { entryPoint: 'main', source: FEEDBACK_SMOKE_FRAG } }
         });
     } else {
         shader = Shader.from({
             gl: { vertex: BASIC_VERTEX, fragment: FEEDBACK_SMOKE_FRAG },
         });
     }

     const mesh = new Mesh({ geometry, shader });
     return mesh;
  }

  render(deltaTime: number) {
    if (!this.initialized || !this.app) return;
    
    Telemetry.getInstance().tick();
    const state = useStore.getState();
    const time = performance.now() / 1000;
    const audioLevel = audioAnalyzer.getEnergy();

    this.container.removeChildren();

    // Iterate Layers
    state.layers.forEach(layer => {
        if (layer.opacity === 0) return;
        const activeClip = layer.clips.find(c => c.id === layer.activeClipId);
        
        if (activeClip && activeClip.type === 'GENERATOR') {
            let mesh = this.generatorMeshes.get(activeClip.id);
            
            if (!mesh) {
                mesh = this.createGeneratorMesh(activeClip.generatorId || 'smoke');
                this.generatorMeshes.set(activeClip.id, mesh);
            }

            if (mesh.shader) {
                mesh.shader.resources.uTime = mesh.shader.resources.uniforms.uTime = time;
                mesh.shader.resources.uSeed = mesh.shader.resources.uniforms.uSeed = 1.0;
                
                activeClip.params.forEach(p => {
                    let val = p.value;
                    if (p.name === 'Density' && audioLevel > 0.01) {
                        val += audioLevel * 0.5; 
                    }
                    if (p.name === 'Speed') mesh.shader.resources.uniforms.uSpeed = val;
                    if (p.name === 'Density') mesh.shader.resources.uniforms.uDensity = val;
                });
            }
            
            mesh.alpha = layer.opacity * state.globalOpacity;
            mesh.width = this.app.screen.width;
            mesh.height = this.app.screen.height;
            this.container.addChild(mesh);
        }
    });

    // Mapping Overlay
    if (state.activeView === 'mapping') {
        this.sliceGraphics.clear();
        state.outputs[0].slices.forEach(slice => {
            const w = this.app.screen.width;
            const h = this.app.screen.height;
            this.sliceGraphics.moveTo(slice.points[0].x * w, slice.points[0].y * h);
            this.sliceGraphics.lineTo(slice.points[1].x * w, slice.points[1].y * h);
            this.sliceGraphics.lineTo(slice.points[2].x * w, slice.points[2].y * h);
            this.sliceGraphics.lineTo(slice.points[3].x * w, slice.points[3].y * h);
            this.sliceGraphics.lineTo(slice.points[0].x * w, slice.points[0].y * h);
            this.sliceGraphics.stroke({ width: 2, color: 0x00ff00 });
            
            slice.points.forEach(p => {
                this.sliceGraphics.circle(p.x * w, p.y * h, 5);
                this.sliceGraphics.fill(0x00ff00);
            });
        });
    } else {
        this.sliceGraphics.clear();
    }
  }

  destroy() {
      this.initialized = false;
      this.initPromise = null;
      if (this.app) {
          try {
              this.app.destroy({ removeView: true }, { children: true });
          } catch (e) {
              console.warn("Error destroying app", e);
          }
          this.app = null;
      }
  }
}

// HMR-Safe Singleton Pattern
// This ensures that if the module is reloaded, the old renderer instance is destroyed
// preventing dual-initialization errors with PixiJS global extensions.
const GLOBAL_KEY = '__AETHER_RENDERER__';
const oldInstance = (window as any)[GLOBAL_KEY];

if (oldInstance) {
    console.log("Cleaning up old renderer instance...");
    oldInstance.destroy();
}

export const renderer = new AetherRenderer();
(window as any)[GLOBAL_KEY] = renderer;
