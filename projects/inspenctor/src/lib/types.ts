export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type NormalizedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GuideOrientation = 'vertical' | 'horizontal';

export type BoxEdges = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type Guide = {
  id: string;
  orientation: GuideOrientation;
  position: number;
};

export type ToolMode = 'none' | 'select' | 'guides';

export type TextInspection = {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  textAlign: string;
};

export type InspectMeasurement = {
  rect: Rect;
  paddingRect: Rect;
  marginRect: Rect;
  padding: BoxEdges;
  margin: BoxEdges;
  label: string;
  styles: TextInspection;
};

export type TextBlockAnnotation = {
  id: string;
  rect: Rect;
  text: string;
  styles: TextInspection;
};

export type DistanceAxis = {
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
  x?: number;
  y?: number;
  value: number;
};

export type DistanceOverlay = {
  rectA: Rect;
  rectB: Rect;
  horizontal: DistanceAxis | null;
  vertical: DistanceAxis | null;
  connectors: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
};

export type InspenctorPersistedState = {
  version: 1;
  enabled: boolean;
  toolMode: ToolMode;
  guideOrientation: GuideOrientation;
  guides: Guide[];
  showTypography: boolean;
};
