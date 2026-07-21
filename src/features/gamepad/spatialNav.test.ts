import { describe, expect, it } from 'vitest';
import { pickNext, type NavRect } from './spatialNav';

const rect = (left: number, top: number, width = 100, height = 40): NavRect => ({
  left,
  top,
  width,
  height
});

describe('pickNext', () => {
  it('sin origen devuelve el elemento más arriba a la izquierda', () => {
    const rects = [rect(200, 100), rect(0, 0), rect(120, 0)];
    expect(pickNext(rects, null, 'down')).toBe(1);
    expect(pickNext([], null, 'down')).toBeNull();
  });

  it('recorre una lista vertical en ambos sentidos sin envolver', () => {
    const list = [rect(0, 0), rect(0, 50), rect(0, 100)];
    expect(pickNext(list, 0, 'down')).toBe(1);
    expect(pickNext(list, 1, 'down')).toBe(2);
    expect(pickNext(list, 2, 'down')).toBeNull();
    expect(pickNext(list, 2, 'up')).toBe(1);
    expect(pickNext(list, 0, 'up')).toBeNull();
  });

  it('en una rejilla prefiere la misma columna al bajar y la misma fila al ir a la derecha', () => {
    // 2x2: [0][1] / [2][3]
    const grid = [rect(0, 0), rect(120, 0), rect(0, 60), rect(120, 60)];
    expect(pickNext(grid, 0, 'down')).toBe(2);
    expect(pickNext(grid, 0, 'right')).toBe(1);
    expect(pickNext(grid, 3, 'up')).toBe(1);
    expect(pickNext(grid, 3, 'left')).toBe(2);
  });

  it('acepta candidatos desalineados si son lo más cercano en esa dirección', () => {
    // Fila de botones arriba y una tarjeta grande debajo, desplazada.
    const rects = [rect(0, 0, 44, 44), rect(60, 0, 44, 44), rect(30, 80, 200, 100)];
    expect(pickNext(rects, 0, 'down')).toBe(2);
    expect(pickNext(rects, 2, 'up')).toBe(1);
  });

  it('ignora candidatos en la dirección contraria', () => {
    const rects = [rect(0, 0), rect(0, 50)];
    expect(pickNext(rects, 0, 'up')).toBeNull();
    expect(pickNext(rects, 0, 'left')).toBeNull();
    expect(pickNext(rects, 0, 'right')).toBeNull();
  });
});
