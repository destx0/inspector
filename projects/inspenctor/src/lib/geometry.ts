import { Rect } from './types';

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const getViewportSize = () => ({
  width: typeof window === 'undefined' ? 1 : window.innerWidth || 1,
  height: typeof window === 'undefined' ? 1 : window.innerHeight || 1,
});

export const rectContainsPoint = (
  rect: Rect,
  point: { x: number; y: number },
) =>
  point.x >= rect.left &&
  point.x <= rect.left + rect.width &&
  point.y >= rect.top &&
  point.y <= rect.top + rect.height;

export const rectsEqual = (a: Rect | null, b: Rect | null, epsilon = 0.5) => {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    Math.abs(a.left - b.left) < epsilon &&
    Math.abs(a.top - b.top) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
};
