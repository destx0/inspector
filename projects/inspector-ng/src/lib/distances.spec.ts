import { getDistanceOverlay } from './distances';

describe('getDistanceOverlay', () => {
  it('measures the nearest boundaries when one rectangle is inside another', () => {
    const outer = { left: 10, top: 20, width: 200, height: 120 };
    const inner = { left: 40, top: 45, width: 50, height: 30 };

    const overlay = getDistanceOverlay(inner, outer);

    expect(overlay.horizontal).toEqual({
      x1: 10,
      x2: 40,
      y: 60,
      value: 30,
    });
    expect(overlay.vertical).toEqual({
      y1: 20,
      y2: 45,
      x: 65,
      value: 25,
    });
    expect(overlay.horizontalDistances).toEqual([
      { x1: 10, x2: 40, y: 60, value: 30 },
      { x1: 90, x2: 210, y: 60, value: 120 },
    ]);
    expect(overlay.verticalDistances).toEqual([
      { y1: 20, y2: 45, x: 65, value: 25 },
      { y1: 75, y2: 140, x: 65, value: 65 },
    ]);
  });

  it('uses the available opposite boundary when the inner rectangle touches an edge', () => {
    const outer = { left: 10, top: 20, width: 100, height: 100 };
    const inner = { left: 10, top: 50, width: 70, height: 70 };

    const overlay = getDistanceOverlay(outer, inner);

    expect(overlay.horizontal?.value).toBe(30);
    expect(overlay.horizontal?.x1).toBe(80);
    expect(overlay.horizontal?.x2).toBe(110);
    expect(overlay.vertical?.value).toBe(30);
    expect(overlay.horizontalDistances.map(({ value }) => value)).toEqual([30]);
    expect(overlay.verticalDistances.map(({ value }) => value)).toEqual([30]);
  });
});
