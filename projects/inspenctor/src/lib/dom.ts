import { InspectMeasurement, Rect, TextBlockAnnotation, TextInspection } from './types';

export const getRectFromDom = (element: Element): Rect => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
};

export const getElementLabel = (element: HTMLElement) => {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const className = element.className
    ? `.${element.className.toString().split(' ')[0]}`
    : '';
  return `${tag}${id}${className}`;
};

const toHex = (value: number) => value.toString(16).padStart(2, '0');

const normalizeColorToHex = (color: string) => {
  const trimmed = color.trim().toLowerCase();
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return trimmed;
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/,
  );
  if (!rgbMatch) {
    return color;
  }

  const [, r, g, b] = rgbMatch;
  return `#${toHex(Math.round(Number(r)))}${toHex(Math.round(Number(g)))}${toHex(Math.round(Number(b)))}`;
};

export const getTextInspection = (element: HTMLElement): TextInspection => {
  const style = window.getComputedStyle(element);
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: normalizeColorToHex(style.color),
    textAlign: style.textAlign,
  };
};

const parseEdge = (value: string) => Number.parseFloat(value) || 0;

export const getInspectMeasurement = (element: HTMLElement): InspectMeasurement => {
  const rect = getRectFromDom(element);
  const style = window.getComputedStyle(element);
  const padding = {
    top: parseEdge(style.paddingTop),
    right: parseEdge(style.paddingRight),
    bottom: parseEdge(style.paddingBottom),
    left: parseEdge(style.paddingLeft),
  };
  const margin = {
    top: parseEdge(style.marginTop),
    right: parseEdge(style.marginRight),
    bottom: parseEdge(style.marginBottom),
    left: parseEdge(style.marginLeft),
  };

  return {
    rect,
    paddingRect: {
      left: rect.left + padding.left,
      top: rect.top + padding.top,
      width: Math.max(0, rect.width - padding.left - padding.right),
      height: Math.max(0, rect.height - padding.top - padding.bottom),
    },
    marginRect: {
      left: rect.left - margin.left,
      top: rect.top - margin.top,
      width: rect.width + margin.left + margin.right,
      height: rect.height + margin.top + margin.bottom,
    },
    padding,
    margin,
    label: getElementLabel(element),
    styles: getTextInspection(element),
  };
};

const isVisibleTextCandidate = (element: HTMLElement) => {
  const text = element.innerText?.trim() ?? '';
  if (!text) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number.parseFloat(style.opacity || '1') === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    return false;
  }

  for (const child of Array.from(element.children)) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    if ((child.innerText?.trim() ?? '') && child.getBoundingClientRect().height > 0) {
      return false;
    }
  }

  return true;
};

export const getVisibleTextBlocks = (
  overlayElement: HTMLElement | null,
  limit = 160,
): TextBlockAnnotation[] => {
  if (typeof document === 'undefined') {
    return [];
  }

  const nodes = Array.from(document.querySelectorAll('body *'));
  const blocks: TextBlockAnnotation[] = [];

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (overlayElement && overlayElement.contains(node)) {
      continue;
    }
    if (!isVisibleTextCandidate(node)) {
      continue;
    }

    const rect = getRectFromDom(node);
    const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    blocks.push({
      id: `${node.tagName.toLowerCase()}-${Math.round(rect.left)}-${Math.round(rect.top)}-${text.slice(0, 24)}`,
      rect,
      text,
      styles: getTextInspection(node),
    });

    if (blocks.length >= limit) {
      break;
    }
  }

  return blocks;
};

export const getTargetElement = (
  point: { x: number; y: number },
  overlayElement: HTMLElement | null,
) => {
  if (typeof document === 'undefined') {
    return null;
  }

  if (overlayElement) {
    const previous = overlayElement.style.pointerEvents;
    overlayElement.style.pointerEvents = 'none';
    const elements = document.elementsFromPoint(point.x, point.y);
    overlayElement.style.pointerEvents = previous;

    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      if (overlayElement.contains(element)) {
        continue;
      }
      if (element === document.body || element === document.documentElement) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) {
        continue;
      }
      return element;
    }

    return null;
  }

  return document.elementFromPoint(point.x, point.y) as HTMLElement | null;
};
