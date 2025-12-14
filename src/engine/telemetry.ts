export class Telemetry {
  private static instance: Telemetry;
  fps: number = 60;
  frameTime: number = 0;
  drawCalls: number = 0;
  private lastTime: number = 0;
  private frameCount: number = 0;

  private constructor() {
    this.lastTime = performance.now();
  }

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  tick() {
    const now = performance.now();
    this.frameCount++;
    if (now >= this.lastTime + 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }
    this.frameTime = now - this.lastTime;
  }
}