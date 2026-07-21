export type ScrollEngineState = {
  playing: boolean;
  position: number;
  baseSpeed: number;
  manualDirection: -1 | 0 | 1;
  manualSpeed: number;
  temporarySpeedMultiplier: number;
};

export const MAX_DELTA_SECONDS = 0.1;

export class ScrollEngine {
  state: ScrollEngineState = {
    playing: false,
    position: 0,
    baseSpeed: 65,
    manualDirection: 0,
    manualSpeed: 0,
    temporarySpeedMultiplier: 1
  };

  maxPosition = Number.POSITIVE_INFINITY;

  private lastTimeMs: number | null = null;

  setMaxPosition(max: number): void {
    this.maxPosition = Math.max(0, max);
    this.state.position = this.clamp(this.state.position);
  }

  /** Avanza la simulación hasta `nowMs` y devuelve la posición resultante. */
  tick(nowMs: number): number {
    if (this.lastTimeMs === null) {
      this.lastTimeMs = nowMs;
      return this.state.position;
    }
    let dt = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;
    if (dt < 0) dt = 0;
    if (dt > MAX_DELTA_SECONDS) dt = MAX_DELTA_SECONDS;

    const auto = this.state.playing
      ? this.state.baseSpeed * this.state.temporarySpeedMultiplier * dt
      : 0;
    const manual = this.state.manualDirection * this.state.manualSpeed * dt;
    this.state.position = this.clamp(this.state.position + auto + manual);
    return this.state.position;
  }

  /** Olvida el último timestamp (p. ej. al volver de background) para no dar saltos. */
  resetClock(): void {
    this.lastTimeMs = null;
  }

  seek(position: number): void {
    this.state.position = this.clamp(position);
  }

  setManual(direction: -1 | 0 | 1, speed: number): void {
    this.state.manualDirection = direction;
    this.state.manualSpeed = Math.max(0, speed);
  }

  private clamp(position: number): number {
    return Math.min(this.maxPosition, Math.max(0, position));
  }
}
