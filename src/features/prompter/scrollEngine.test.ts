import { describe, expect, it } from 'vitest';
import { MAX_DELTA_SECONDS, ScrollEngine } from './scrollEngine';

function makeEngine(): ScrollEngine {
  const engine = new ScrollEngine();
  engine.setMaxPosition(10000);
  engine.tick(0); // primer tick fija el reloj
  return engine;
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
    expect(engine.tick(50)).toBeCloseTo(5);
  });

  it('aplica el multiplicador temporal de velocidad', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    engine.state.temporarySpeedMultiplier = 2;
    expect(engine.tick(50)).toBeCloseTo(10);
  });

  it('limita dt a MAX_DELTA_SECONDS (p. ej. al volver de background)', () => {
    const engine = makeEngine();
    engine.state.playing = true;
    engine.state.baseSpeed = 100;
    expect(engine.tick(60_000)).toBeCloseTo(100 * MAX_DELTA_SECONDS);
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
