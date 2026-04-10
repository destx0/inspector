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
  const connectors: DistanceOverlay['connectors'] = [];

  const separatedX = rightA <= rectB.left || rightB <= rectA.left;
  const separatedY = bottomA <= rectB.top || bottomB <= rectA.top;

  if (separatedX) {
    const aIsLeft = rightA <= rectB.left;
    const x1 = aIsLeft ? rightA : rightB;
    const x2 = aIsLeft ? rectB.left : rectA.left;
    const y = centerAY;
    horizontal = { x1, x2, y, value: Math.abs(x2 - x1) };

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

    const edgeBY = aIsTop ? rectB.top : bottomB;
    if (x < rectB.left) {
      connectors.push({ x1: x, y1: edgeBY, x2: rectB.left, y2: edgeBY });
    } else if (x > rightB) {
      connectors.push({ x1: x, y1: edgeBY, x2: rightB, y2: edgeBY });
    }
  }

  const viewport = getViewportSize();

  return {
    rectA,
    rectB,
    horizontal,
    vertical,
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
