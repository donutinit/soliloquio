import { describe, expect, it } from 'vitest';
import { MAX_DELTA_SECONDS, RAMP_SECONDS, ScrollEngine } from './scrollEngine';

function makeEngine(): ScrollEngine {
  const engine = new ScrollEngine();
  engine.setMaxPosition(10000);
  engine.tick(0); // primer tick fija el reloj
  return engine;
}

/** Advances in 10 ms frames, like a display loop, from `fromMs` to `untilMs`. */
function tickUntil(engine: ScrollEngine, untilMs: number, fromMs = 0): void {
  for (let t = fromMs + 10; t < untilMs; t += 10) engine.tick(t);
  engine.tick(untilMs);
}

describe('ScrollEngine', () => {
  it('starts with the reader default speed', () => {
    expect(new ScrollEngine().state.baseSpeed).toBe(55);
  });

  it('no avanza en pausa sin entrada manual', () => {
    const engine = makeEngine();
    expect(engine.tick(1000)).toBe(0);
  });

  it('avanza según baseSpeed al reproducir', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    tickUntil(engine, 1000);
    const before = engine.state.position;
    expect(engine.tick(1050) - before).toBeCloseTo(5);
  });

  it('aplica el multiplicador temporal de velocidad', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    engine.state.temporarySpeedMultiplier = 2;
    tickUntil(engine, 1000);
    const before = engine.state.position;
    expect(engine.tick(1050) - before).toBeCloseTo(10);
  });

  it('eases from rest to full speed over the ramp', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    // Half of the ramp covers a quarter of the full-speed distance for that time.
    tickUntil(engine, (RAMP_SECONDS / 2) * 1000);
    expect(engine.state.position).toBeCloseTo(100 * RAMP_SECONDS * 0.125);
    tickUntil(engine, RAMP_SECONDS * 1000, (RAMP_SECONDS / 2) * 1000);
    expect(engine.state.position).toBeCloseTo(100 * RAMP_SECONDS * 0.5);
  });

  it('keeps the ramp frame-rate independent', () => {
    const coarse = makeEngine();
    const fine = makeEngine();
    for (const engine of [coarse, fine]) {
      engine.state.playing = true;
      engine.state.baseSpeed = 100;
    }
    for (let t = 100; t <= 1000; t += 100) coarse.tick(t);
    for (let t = 16; t <= 1000; t += 16) fine.tick(t);
    fine.tick(1000);
    expect(fine.state.position).toBeCloseTo(coarse.state.position, 6);
  });

  it('restarts the ramp after pausing', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    tickUntil(engine, 1000);
    engine.state.playing = false;
    engine.tick(1100);
    engine.state.playing = true;
    const before = engine.state.position;
    expect(engine.tick(1150) - before).toBeLessThan(1);
  });

  it('holds position during a timed pause, counts it as elapsed, and resumes', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    engine.hold(0.25);
    tickUntil(engine, 250);
    expect(engine.state.position).toBe(0);
    expect(engine.state.elapsedSeconds).toBeCloseTo(0.25);
    tickUntil(engine, 250 + RAMP_SECONDS * 1000, 250);
    expect(engine.state.position).toBeCloseTo(100 * RAMP_SECONDS * 0.5);
  });

  it('ends a timed hold when the reader seeks', () => {
    const engine = makeEngine();
    engine.hold(5);
    engine.seek(10);
    expect(engine.state.holdSeconds).toBe(0);
  });

  it('counts elapsed time only while playing', () => {
    const engine = makeEngine();
    engine.tick(1000);
    expect(engine.state.elapsedSeconds).toBe(0);
    engine.state.playing = true;
    tickUntil(engine, 2000, 1000);
    expect(engine.state.elapsedSeconds).toBeCloseTo(1);
    engine.resetElapsed();
    expect(engine.state.elapsedSeconds).toBe(0);
  });

  it('limita dt a MAX_DELTA_SECONDS (p. ej. al volver de background)', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    tickUntil(engine, 1000);
    const before = engine.state.position;
    expect(engine.tick(60_000) - before).toBeCloseTo(100 * MAX_DELTA_SECONDS);
  });

  it('el scroll manual funciona también en pausa y no cambia play/pause', () => {
    const engine = makeEngine();
    engine.setManual(1, 220);
    expect(engine.tick(100)).toBeCloseTo(22);
    expect(engine.state.playing).toBe(false);
    engine.setManual(-1, 220);
    engine.tick(200);
    expect(engine.state.position).toBeCloseTo(0);
  });

  it('respeta los límites inferior y superior', () => {
    const engine = makeEngine();
    engine.setManual(-1, 1000);
    expect(engine.tick(5000)).toBe(0);
    engine.setMaxPosition(50);
    engine.setManual(1, 100000);
    engine.tick(6000);
    engine.tick(7000);
    expect(engine.state.position).toBe(50);
  });

  it('setManual no acepta velocidades negativas', () => {
    const engine = makeEngine();
    engine.setManual(1, -500);
    expect(engine.state.manualSpeed).toBe(0);
    engine.tick(1000);
    expect(engine.state.position).toBe(0);
  });

  it('resetClock evita saltos tras una pausa del reloj', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    engine.tick(100);
    const before = engine.state.position;
    engine.resetClock();
    expect(engine.tick(99_000)).toBe(before);
  });

  it('seek restaura una posición dentro de los límites', () => {
    const engine = makeEngine();
    engine.seek(500);
    expect(engine.state.position).toBe(500);
    engine.seek(-10);
    expect(engine.state.position).toBe(0);
    engine.seek(99999);
    expect(engine.state.position).toBe(10000);
  });
});
