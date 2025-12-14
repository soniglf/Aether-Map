export class AudioAnalyzer {
  private context: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private initializing = false;

  async init() {
    if (this.context || this.initializing) return;
    this.initializing = true;
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.source = this.context.createMediaStreamSource(stream);
      this.analyzer = this.context.createAnalyser();
      this.analyzer.fftSize = 256;
      this.source.connect(this.analyzer);
      this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    } catch (e) {
      console.warn("Audio input failed or denied", e);
    } finally {
        this.initializing = false;
    }
  }

  getEnergy(): number {
    if (!this.analyzer || !this.dataArray) return 0;
    this.analyzer.getByteFrequencyData(this.dataArray);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length / 2; i++) {
      sum += this.dataArray[i];
    }
    return (sum / (this.dataArray.length / 2)) / 255;
  }

  close() {
      if (this.context) {
          this.context.close();
          this.context = null;
      }
      this.source = null;
      this.analyzer = null;
  }
}

// HMR Safe Singleton
const GLOBAL_KEY = '__AETHER_AUDIO__';
const oldInstance = (window as any)[GLOBAL_KEY];
if (oldInstance) {
    oldInstance.close();
}

export const audioAnalyzer = new AudioAnalyzer();
(window as any)[GLOBAL_KEY] = audioAnalyzer;
