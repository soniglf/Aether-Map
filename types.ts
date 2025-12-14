export enum ClipType {
  GENERATOR = 'GENERATOR',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE'
}

export interface Parameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  modulatorId?: string;
}

export interface Clip {
  id: string;
  name: string;
  type: ClipType;
  active: boolean;
  thumbnail?: string;
  params: Parameter[];
  sourceUrl?: string; // For video/image
  generatorId?: string; // For generative content
}

export interface Layer {
  id: string;
  name: string;
  opacity: number;
  clips: Clip[];
  activeClipId: string | null;
}

export interface Slice {
  id: string;
  name: string;
  points: { x: number; y: number }[]; // 0-1 normalized coordinates
  active: boolean;
}

export interface OutputConfig {
  id: string;
  name: string;
  slices: Slice[];
}

export interface ProjectState {
  layers: Layer[];
  outputs: OutputConfig[];
  bpm: number;
  globalOpacity: number;
}
