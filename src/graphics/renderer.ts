import { Application, Container, Graphics, Shader, Mesh, Geometry, Texture, RenderTexture, Sprite, Assets } from 'pixi.js';
import { useStore } from '../model/store';
import { BASIC_VERTEX, FEEDBACK_SMOKE_FRAG } from './shaders/generators';
import { audioAnalyzer } from '../media/audioAnalysis';
import { Telemetry } from '../engine/telemetry';
import { ClipType } from '../../types';

class AetherRenderer {
  app: Application | null = null;
  
  // Pipeline
  private compositionTexture: RenderTexture | null = null;
  private compositionContainer: Container; // Holds layers
  private outputContainer: Container; // Holds slices
  
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  
  // Cache
  private generatorMeshes: Map<string, Mesh> = new Map();
  private sliceMeshes: Map<string, Mesh> = new Map();
  private clipSprites: Map<string, Sprite> = new Map();
  private textureCache: Map<string, Texture> = new Map();

  constructor() {
    this.compositionContainer = new Container();
    this.outputContainer = new Container();
  }

  async init(container: HTMLElement) {
    if (this.initPromise) {
        await this.initPromise;
        if (this.app?.canvas && !container.contains(this.app.canvas as unknown as Node)) {
            container.appendChild(this.app.canvas as unknown as Node);
        }
        return;
    }

    this.initPromise = (async () => {
        try {
            if (!this.app) this.app = new Application();

            await this.app.init({
                resizeTo: window,
                preference: 'webgpu',
                background: '#000000',
                antialias: true
            });

            if (this.app.canvas) container.appendChild(this.app.canvas as unknown as Node);

            // Create offscreen buffer for composition (Mixer)
            // We use a fixed resolution for internal composition (e.g., 1080p) to ensure consistency
            this.compositionTexture = RenderTexture.create({ width: 1920, height: 1080 });
            
            this.app.stage.addChild(this.outputContainer);
            
            // Loop
            this.app.ticker.add((ticker) => {
                this.render(ticker.deltaTime);
            });

            this.initialized = true;
            console.log("Aether Engine Initialized (Pro Pipeline)");

        } catch (e: any) {
            console.error("Renderer Init Failed:", e);
            this.initPromise = null;
            if (this.app) { try { await this.app.destroy(); } catch {} this.app = null; }
            throw e;
        }
    })();
    return this.initPromise;
  }

  // --- MESH GENERATION FOR SLICES ---
  private updateSliceMesh(id: string, points: {x:number, y:number}[], texture: Texture) {
     let mesh = this.sliceMeshes.get(id);
     
     // Points are 0-1 normalized. Map to screen coords.
     const w = this.app!.screen.width;
     const h = this.app!.screen.height;
     
     // Vertices: 4 points (TopLeft, TopRight, BottomRight, BottomLeft)
     // Order for Triangle Strip or standard Index buffer matters.
     // Let's use standard Quad index: 0-1-2, 0-2-3
     const vertices = new Float32Array([
         points[0].x * w, points[0].y * h, // TL
         points[1].x * w, points[1].y * h, // TR
         points[2].x * w, points[2].y * h, // BR
         points[3].x * w, points[3].y * h  // BL
     ]);

     const uvs = new Float32Array([
         0, 0, // TL
         1, 0, // TR
         1, 1, // BR
         0, 1  // BL
     ]);
     
     const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

     if (!mesh) {
         const geometry = new Geometry({
             attributes: {
                 aPosition: vertices,
                 aUV: uvs
             },
             indexBuffer: indices
         });
         
         // Simple shader that just maps texture
         const shader = Shader.from({
             gl: { vertex: BASIC_VERTEX, fragment: `
                precision highp float;
                in vec2 vTextureCoord;
                out vec4 outColor;
                uniform sampler2D uTexture;
                void main() { outColor = texture(uTexture, vTextureCoord); }
             `},
         });
         
         mesh = new Mesh({ geometry, shader });
         mesh.texture = texture;
         this.outputContainer.addChild(mesh);
         this.sliceMeshes.set(id, mesh);
     } else {
         // Update geometry
         const buffer = mesh.geometry.getAttribute('aPosition').buffer;
         buffer.data = vertices;
         buffer.update();
         mesh.texture = texture; // Ensure texture is current
     }
  }

  // --- CONTENT LOADING ---
  private async getClipContent(clip: any): Promise<Container | null> {
      if (clip.type === ClipType.GENERATOR) {
          let mesh = this.generatorMeshes.get(clip.id);
          if (!mesh) {
              mesh = this.createGeneratorMesh(clip.generatorId || 'smoke');
              this.generatorMeshes.set(clip.id, mesh);
          }
          // Update Generator Uniforms
          if (mesh.shader) {
            const time = performance.now() / 1000;
            const audio = audioAnalyzer.getEnergy();
            mesh.shader.resources.uTime = mesh.shader.resources.uniforms.uTime = time;
            // Map params
            clip.params.forEach((p:any) => {
                if(p.name === 'Speed') mesh!.shader.resources.uniforms.uSpeed = p.value;
                if(p.name === 'Density') mesh!.shader.resources.uniforms.uDensity = p.value + (audio * 0.5);
            });
          }
          return mesh;
      } 
      else if (clip.type === ClipType.VIDEO || clip.type === ClipType.IMAGE) {
          if (!clip.sourceUrl) return null;
          
          let sprite = this.clipSprites.get(clip.id);
          if (!sprite) {
              // Try to reuse texture if exists
              if (!this.textureCache.has(clip.sourceUrl)) {
                 try {
                     const texture = await Assets.load(clip.sourceUrl);
                     if (clip.type === ClipType.VIDEO) {
                         const source = texture.source.resource as HTMLVideoElement;
                         if (source && source.loop !== undefined) {
                             source.loop = true;
                             source.muted = true;
                             source.play();
                         }
                     }
                     this.textureCache.set(clip.sourceUrl, texture);
                 } catch (e) {
                     console.warn("Failed to load asset", clip.sourceUrl);
                     return null;
                 }
              }
              sprite = new Sprite(this.textureCache.get(clip.sourceUrl));
              this.clipSprites.set(clip.id, sprite);
          }
          return sprite;
      }
      return null;
  }

  private createGeneratorMesh(type: string): Mesh {
     const geometry = new Geometry({
         attributes: {
             aPosition: [-1, -1, 1, -1, 1, 1, -1, 1], // Full clip space
             aUV: [0, 0, 1, 0, 1, 1, 0, 1]
         },
         indexBuffer: [0, 1, 2, 0, 2, 3]
     });
     const shader = Shader.from({
         gl: { vertex: BASIC_VERTEX, fragment: FEEDBACK_SMOKE_FRAG },
     });
     return new Mesh({ geometry, shader });
  }

  render(deltaTime: number) {
    if (!this.initialized || !this.app || !this.compositionTexture) return;
    
    Telemetry.getInstance().tick();
    const state = useStore.getState();

    // 1. Render Layers to Composition Buffer
    // We manually clear the container and re-add active clips.
    // In a simpler engine, we might keep them added and toggle visibility,
    // but for dynamic clip switching, rebuilding the simple display list is fine.
    this.compositionContainer.removeChildren();
    
    // Reverse layer order for painter's algorithm (Bottom layer first)
    // Actually store order: L3 (Top), L2, L1 (Bottom). So we iterate backwards?
    // Let's assume store order is Bottom -> Top. L1 is index 0.
    for (const layer of state.layers) {
        if (layer.opacity === 0) continue;
        const activeClip = layer.clips.find(c => c.id === layer.activeClipId);
        
        if (activeClip) {
            // Because getClipContent might be async for loading, strictly we should handle that.
            // But for this loop we assume cache hit.
            // We'll use a sync check for cache availability.
            let content: Container | null = null;
            
            if (activeClip.type === ClipType.GENERATOR) {
                content = this.generatorMeshes.get(activeClip.id) || null;
                // If not created yet, create synchronously (generators are fast)
                if (!content) { 
                    content = this.createGeneratorMesh(activeClip.generatorId || 'smoke'); 
                    this.generatorMeshes.set(activeClip.id, content as Mesh);
                }
                // Update uniforms logic repeats here or extracted. 
                // For brevity, assuming generator meshes update via their reference or in previous step.
                 const mesh = content as Mesh;
                 const time = performance.now() / 1000;
                 const audio = audioAnalyzer.getEnergy();
                 if(mesh.shader) {
                    mesh.shader.resources.uTime = mesh.shader.resources.uniforms.uTime = time;
                    activeClip.params.forEach(p => {
                         if(p.name === 'Speed') mesh.shader.resources.uniforms.uSpeed = p.value;
                         if(p.name === 'Density') mesh.shader.resources.uniforms.uDensity = p.value + (audio * 0.5);
                    });
                 }

            } else {
                content = this.clipSprites.get(activeClip.id) || null;
                // Async load happens elsewhere? Trigger it if missing.
                if (!content && activeClip.sourceUrl) {
                    this.getClipContent(activeClip); // Trigger load
                }
            }

            if (content) {
                content.alpha = layer.opacity;
                content.width = 1920; // Fit comp
                content.height = 1080;
                this.compositionContainer.addChild(content);
            }
        }
    }

    // Render Composition to Texture
    this.app.renderer.render({
        container: this.compositionContainer,
        target: this.compositionTexture,
        clear: true
    });

    // 2. Render Output Slices (Warping)
    // Ensure all output slices exist as meshes and are updated
    state.outputs[0].slices.forEach(slice => {
        if (!slice.active) return;
        this.updateSliceMesh(slice.id, slice.points, this.compositionTexture!);
    });

    // If we are in "Mapping" view, we might want to see lines?
    // The MappingView component draws DOM handles overlay, so we just render the warped content behind it.
  }

  destroy() {
      this.initialized = false;
      this.initPromise = null;
      if (this.app) {
          try {
              this.app.destroy({ removeView: true }, { children: true });
          } catch {}
          this.app = null;
      }
  }
}

// HMR Safe Singleton
const GLOBAL_KEY = '__AETHER_RENDERER__';
const oldInstance = (window as any)[GLOBAL_KEY];
if (oldInstance) oldInstance.destroy();

export const renderer = new AetherRenderer();
(window as any)[GLOBAL_KEY] = renderer;
