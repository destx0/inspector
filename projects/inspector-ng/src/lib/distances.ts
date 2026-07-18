import { clamp, getViewportSize } from './geometry';
import { DistanceOverlay, Rect } from './types';

export const getDistanceOverlay = (rectA: Rect, rectB: Rect): DistanceOverlay => {
  const rightA = rectA.left + rectA.width;
  const bottomA = rectA.top + rectA.height;
  const rightB = rectB.left + rectB.width;
  const bottomB = rectB.top + rectB.height;
  const centerAX = rectA.left + rectA.width / 2;
  const centerAY = rectA.top + rectA.height / 2;

  let horizontal: DistanceOverlay['horizontal'] = null;
  let vertical: DistanceOverlay['vertical'] = null;
  let horizontalDistances: DistanceOverlay['horizontalDistances'] = [];
  let verticalDistances: DistanceOverlay['verticalDistances'] = [];
  const connectors: DistanceOverlay['connectors'] = [];

  const separatedX = rightA <= rectB.left || rightB <= rectA.left;
  const separatedY = bottomA <= rectB.top || bottomB <= rectA.top;

  if (separatedX) {
    const aIsLeft = rightA <= rectB.left;
    const x1 = aIsLeft ? rightA : rightB;
    const x2 = aIsLeft ? rectB.left : rectA.left;
    const y = centerAY;
    horizontal = { x1, x2, y, value: Math.abs(x2 - x1) };
    horizontalDistances = [horizontal];

    const edgeBX = aIsLeft ? rectB.left : rightB;
    if (y < rectB.top) {
      connectors.push({ x1: edgeBX, y1: y, x2: edgeBX, y2: rectB.top });
    } else if (y > bottomB) {
      connectors.push({ x1: edgeBX, y1: y, x2: edgeBX, y2: bottomB });
    }
  }

  if (separatedY) {
    const aIsTop = bottomA <= rectB.top;
    const y1 = aIsTop ? bottomA : bottomB;
    const y2 = aIsTop ? rectB.top : rectA.top;
    const x = centerAX;
    vertical = { y1, y2, x, value: Math.abs(y2 - y1) };
    verticalDistances = [vertical];

    const edgeBY = aIsTop ? rectB.top : bottomB;
    if (x < rectB.left) {
      connectors.push({ x1: x, y1: edgeBY, x2: rectB.left, y2: edgeBY });
    } else if (x > rightB) {
      connectors.push({ x1: x, y1: edgeBY, x2: rightB, y2: edgeBY });
    }
  }

  if (!separatedX && !separatedY) {
    const nestedRects = getNestedRects(rectA, rectB);
    if (nestedRects) {
      const { inner, outer } = nestedRects;
      const innerRight = inner.left + inner.width;
      const innerBottom = inner.top + inner.height;
      const outerRight = outer.left + outer.width;
      const outerBottom = outer.top + outer.height;
      const horizontalY = inner.top + inner.height / 2;
      const verticalX = inner.left + inner.width / 2;
      const startHorizontal = {
        x1: outer.left,
        x2: inner.left,
        y: horizontalY,
        value: inner.left - outer.left,
      };
      const endHorizontal = {
        x1: innerRight,
        x2: outerRight,
        y: horizontalY,
        value: outerRight - innerRight,
      };
      const startVertical = {
        y1: outer.top,
        y2: inner.top,
        x: verticalX,
        value: inner.top - outer.top,
      };
      const endVertical = {
        y1: innerBottom,
        y2: outerBottom,
        x: verticalX,
        value: outerBottom - innerBottom,
      };

      horizontalDistances = [startHorizontal, endHorizontal].filter(
        ({ value }) => value > 0.5,
      );
      verticalDistances = [startVertical, endVertical].filter(
        ({ value }) => value > 0.5,
      );
      const horizontalBoundary = nearestPositiveBoundary(
        startHorizontal.value,
        endHorizontal.value,
      );
      const verticalBoundary = nearestPositiveBoundary(
        startVertical.value,
        endVertical.value,
      );

      if (horizontalBoundary === 'start') {
        horizontal = startHorizontal;
      } else if (horizontalBoundary === 'end') {
        horizontal = endHorizontal;
      }

      if (verticalBoundary === 'start') {
        vertical = startVertical;
      } else if (verticalBoundary === 'end') {
        vertical = endVertical;
      }
    }
  }

  const viewport = getViewportSize();

  return {
    rectA,
    rectB,
    horizontal,
    vertical,
    horizontalDistances,
    verticalDistances,
    connectors: connectors
      .map((segment) => ({
        x1: clamp(segment.x1, 0, viewport.width),
        y1: clamp(segment.y1, 0, viewport.height),
        x2: clamp(segment.x2, 0, viewport.width),
        y2: clamp(segment.y2, 0, viewport.height),
      }))
      .filter(
        (segment) =>
          Math.abs(segment.x1 - segment.x2) > 0.5 ||
          Math.abs(segment.y1 - segment.y2) > 0.5,
      ),
  };
};

const getNestedRects = (
  rectA: Rect,
  rectB: Rect,
): { inner: Rect; outer: Rect } | null => {
  if (containsRect(rectA, rectB)) return { inner: rectB, outer: rectA };
  if (containsRect(rectB, rectA)) return { inner: rectA, outer: rectB };
  return null;
};

const containsRect = (outer: Rect, inner: Rect): boolean =>
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  inner.left + inner.width <= outer.left + outer.width &&
  inner.top + inner.height <= outer.top + outer.height;

const nearestPositiveBoundary = (
  startDistance: number,
  endDistance: number,
): 'start' | 'end' | null => {
  const startIsPositive = startDistance > 0.5;
  const endIsPositive = endDistance > 0.5;
  if (!startIsPositive) return endIsPositive ? 'end' : null;
  if (!endIsPositive) return 'start';
  return startDistance <= endDistance ? 'start' : 'end';
};
