import { Application, Container, Shader, Mesh, Geometry, Texture, RenderTexture, Sprite, Assets } from 'pixi.js';
import { useStore } from '../model/store';
import { BASIC_VERTEX, FEEDBACK_SMOKE_FRAG, VORONOI_FLOW_FRAG, SCANLINE_GRID_FRAG } from './shaders/generators';
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
  
  // Cache & Resources
  private generatorMeshes: Map<string, Mesh> = new Map();
  private sliceMeshes: Map<string, Mesh> = new Map();
  private clipSprites: Map<string, Sprite> = new Map();
  private textureCache: Map<string, Texture> = new Map(); // Url -> Texture
  private videoElements: Map<string, HTMLVideoElement> = new Map(); // Url -> VideoElement

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
                antialias: true,
                powerPreference: 'high-performance'
            });

            if (this.app.canvas) container.appendChild(this.app.canvas as unknown as Node);

            // Mixer Buffer (Internal Resolution)
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

  // --- RESOURCE MANAGEMENT ---
  private cleanUpOrphans() {
      const state = useStore.getState();
      if (state.orphanedResources.length > 0) {
          state.orphanedResources.forEach(url => {
              // Destroy texture
              if (this.textureCache.has(url)) {
                  const tex = this.textureCache.get(url);
                  if (tex) tex.destroy(true); // True = destroy base texture
                  this.textureCache.delete(url);
              }
              // Destroy video element
              if (this.videoElements.has(url)) {
                  const vid = this.videoElements.get(url);
                  if (vid) {
                      vid.pause();
                      vid.src = "";
                      vid.load();
                  }
                  this.videoElements.delete(url);
              }
              // Revoke Blob
              if (url.startsWith('blob:')) {
                  URL.revokeObjectURL(url);
              }
          });
          state.clearOrphanedResources();
          
          // Rebuild sprite cache to remove stale IDs
          // This is a naive sweep. Ideally we track ID -> URL map.
          // For now, if a sprite's texture is destroyed, Pixi might warn. 
          // We should iterate clipSprites and check if destroyed.
          this.clipSprites.forEach((sprite, id) => {
              if (sprite.destroyed || (sprite.texture && !sprite.texture.source)) {
                  this.clipSprites.delete(id);
              }
          });
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
          // Update Uniforms
          if (mesh.shader) {
            const time = performance.now() / 1000;
            const audio = audioAnalyzer.getEnergy();
            mesh.shader.resources.uTime = mesh.shader.resources.uniforms.uTime = time;
            
            // Param Mapping
            const speed = clip.params.find((p:any) => p.name === 'Speed')?.value ?? 1.0;
            const density = clip.params.find((p:any) => p.name === 'Density')?.value ?? 0.5;
            
            mesh.shader.resources.uniforms.uSpeed = speed;
            mesh.shader.resources.uniforms.uDensity = density + (audio * 0.5); // Reactivity
          }
          return mesh;
      } 
      else if (clip.type === ClipType.VIDEO || clip.type === ClipType.IMAGE) {
          if (!clip.sourceUrl) return null;
          
          let sprite = this.clipSprites.get(clip.id);
          
          // Load Texture if needed
          if (!this.textureCache.has(clip.sourceUrl)) {
             try {
                 const texture = await Assets.load(clip.sourceUrl);
                 
                 if (clip.type === ClipType.VIDEO) {
                     const source = texture.source.resource as HTMLVideoElement;
                     if (source) {
                         source.loop = true;
                         source.muted = true;
                         source.play().catch(e => console.warn("Autoplay blocked", e));
                         this.videoElements.set(clip.sourceUrl, source);
                     }
                 }
                 this.textureCache.set(clip.sourceUrl, texture);
             } catch (e) {
                 console.warn("Failed to load asset", clip.sourceUrl);
                 return null;
             }
          }
          
          // Create Sprite if needed
          if (!sprite) {
              const tex = this.textureCache.get(clip.sourceUrl);
              if (tex) {
                  sprite = new Sprite(tex);
                  this.clipSprites.set(clip.id, sprite);
              }
          }
          return sprite || null;
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
     
     let frag = FEEDBACK_SMOKE_FRAG;
     if (type === 'voronoi') frag = VORONOI_FLOW_FRAG;
     if (type === 'scanline') frag = SCANLINE_GRID_FRAG;

     const shader = Shader.from({
         gl: { vertex: BASIC_VERTEX, fragment: frag },
     });
     return new Mesh({ geometry, shader });
  }

  // --- OUTPUT MAPPING ---
  private updateSliceMesh(id: string, points: {x:number, y:number}[], texture: Texture) {
     let mesh = this.sliceMeshes.get(id);
     
     const w = this.app!.screen.width;
     const h = this.app!.screen.height;
     
     // Corner Pin: Map texture quad to arbitrary 4 screen points
     const vertices = new Float32Array([
         points[0].x * w, points[0].y * h, // TL
         points[1].x * w, points[1].y * h, // TR
         points[2].x * w, points[2].y * h, // BR
         points[3].x * w, points[3].y * h  // BL
     ]);
     
     // Standard UVs for the full Composition Texture
     const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
     const indices = new Uint16Array([0, 1, 2, 0, 2, 3]); // Two triangles

     if (!mesh) {
         const geometry = new Geometry({
             attributes: { aPosition: vertices, aUV: uvs },
             indexBuffer: indices
         });
         // Basic texture shader
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
         const buffer = mesh.geometry.getAttribute('aPosition').buffer;
         buffer.data = vertices;
         buffer.update();
         mesh.texture = texture; 
     }
  }

  render(deltaTime: number) {
    if (!this.initialized || !this.app || !this.compositionTexture) return;
    
    // Telemetry
    const telem = Telemetry.getInstance();
    telem.tick();
    telem.activeTextures = this.textureCache.size;
    telem.activeVideos = this.videoElements.size;
    
    this.cleanUpOrphans();
    const state = useStore.getState();

    // 1. MIXER: Render Layers to Composition Buffer
    this.compositionContainer.removeChildren();
    
    // Render layers Bottom -> Top
    for (const layer of state.layers) {
        if (layer.opacity === 0) continue;
        const activeClip = layer.clips.find(c => c.id === layer.activeClipId);
        
        if (activeClip) {
            let content: Container | null = null;
            
            if (activeClip.type === ClipType.GENERATOR) {
                // Sync create/get for generators
                content = this.generatorMeshes.get(activeClip.id) || null;
                if (!content) { 
                    content = this.createGeneratorMesh(activeClip.generatorId || 'smoke'); 
                    this.generatorMeshes.set(activeClip.id, content as Mesh);
                }
                // Uniforms update
                const mesh = content as Mesh;
                if(mesh.shader) {
                    const time = performance.now() / 1000;
                    const audio = audioAnalyzer.getEnergy();
                    mesh.shader.resources.uTime = mesh.shader.resources.uniforms.uTime = time;
                    mesh.shader.resources.uniforms.uSpeed = activeClip.params.find(p => p.name==='Speed')?.value ?? 1;
                    mesh.shader.resources.uniforms.uDensity = (activeClip.params.find(p => p.name==='Density')?.value ?? 0.5) + (audio * 0.2);
                }
            } else {
                // Async get for media
                content = this.clipSprites.get(activeClip.id) || null;
                if (!content && activeClip.sourceUrl) {
                    this.getClipContent(activeClip); // Trigger load
                }
            }

            if (content) {
                content.alpha = layer.opacity * state.globalOpacity;
                content.width = 1920; 
                content.height = 1080;
                this.compositionContainer.addChild(content);
            }
        }
    }

    this.app.renderer.render({
        container: this.compositionContainer,
        target: this.compositionTexture,
        clear: true
    });

    // 2. OUTPUT: Render Slices
    state.outputs[0].slices.forEach(slice => {
        if (!slice.active) return;
        this.updateSliceMesh(slice.id, slice.points, this.compositionTexture!);
    });
    
    // The Pixi View is automatically updated by the ticker rendering the stage (outputContainer)
  }

  destroy() {
      this.initialized = false;
      this.initPromise = null;
      if (this.app) {
          try { this.app.destroy({ removeView: true }, { children: true }); } catch {}
          this.app = null;
      }
  }
}

const GLOBAL_KEY = '__AETHER_RENDERER__';
const oldInstance = (window as any)[GLOBAL_KEY];
if (oldInstance) oldInstance.destroy();

export const renderer = new AetherRenderer();
(window as any)[GLOBAL_KEY] = renderer;
