export type ScrollEngineState = {
  playing: boolean;
  position: number;
  baseSpeed: number;
  manualDirection: -1 | 0 | 1;
  manualSpeed: number;
  temporarySpeedMultiplier: number;
  /** Remaining seconds a timed separator holds automatic scrolling in place. */
  holdSeconds: number;
  /** Seconds of playback (including timed holds) since the last reset. */
  elapsedSeconds: number;
};

export const MAX_DELTA_SECONDS = 0.1;

/** Automatic scrolling eases from rest to full speed over this time. */
export const RAMP_SECONDS = 0.5;
const HOLD_EPSILON_SECONDS = 1e-9;

/**
 * Distance covered after `t` seconds of a linear ramp, in seconds of full
 * speed. Integrating the ramp exactly keeps it frame-rate independent.
 */
function rampDistance(t: number): number {
  return t < RAMP_SECONDS ? (t * t) / (2 * RAMP_SECONDS) : RAMP_SECONDS / 2 + (t - RAMP_SECONDS);
}

export class ScrollEngine {
  state: ScrollEngineState = {
    playing: false,
    position: 0,
    baseSpeed: 55,
    manualDirection: 0,
    manualSpeed: 0,
    temporarySpeedMultiplier: 1,
    holdSeconds: 0,
    elapsedSeconds: 0
  };

  maxPosition = Number.POSITIVE_INFINITY;

  private lastTimeMs: number | null = null;
  /** Seconds of movement since automatic scrolling last started from rest. */
  private rampSeconds = 0;

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

    let auto = 0;
    if (this.state.playing) {
      this.state.elapsedSeconds += dt;
      let moving = dt;
      if (this.state.holdSeconds > 0) {
        // A hold that ends within float noise of this frame spends all of it.
        if (this.state.holdSeconds >= dt - HOLD_EPSILON_SECONDS) {
          this.state.holdSeconds = Math.max(0, this.state.holdSeconds - dt);
          moving = 0;
        } else {
          moving = dt - this.state.holdSeconds;
          this.state.holdSeconds = 0;
        }
      }
      if (moving > 0) {
        const speed = this.state.baseSpeed * this.state.temporarySpeedMultiplier;
        auto = speed * (rampDistance(this.rampSeconds + moving) - rampDistance(this.rampSeconds));
        this.rampSeconds += moving;
      }
    } else {
      this.rampSeconds = 0;
    }
    const manual = this.state.manualDirection * this.state.manualSpeed * dt;
    this.state.position = this.clamp(this.state.position + auto + manual);
    return this.state.position;
  }

  /** Olvida el último timestamp (p. ej. al volver de background) para no dar saltos. */
  resetClock(): void {
    this.lastTimeMs = null;
  }

  /** Moves to `position`; any timed hold ends, since the reader moved on. */
  seek(position: number): void {
    this.state.position = this.clamp(position);
    this.state.holdSeconds = 0;
  }

  /** Holds automatic scrolling for `seconds`, then eases back to speed. */
  hold(seconds: number): void {
    this.state.holdSeconds = Math.max(0, seconds);
    this.rampSeconds = 0;
  }

  resetElapsed(): void {
    this.state.elapsedSeconds = 0;
  }

  setManual(direction: -1 | 0 | 1, speed: number): void {
    this.state.manualDirection = direction;
    this.state.manualSpeed = Math.max(0, speed);
  }

  private clamp(position: number): number {
    return Math.min(this.maxPosition, Math.max(0, position));
  }
}
