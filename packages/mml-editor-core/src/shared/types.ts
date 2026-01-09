export type SceneNodeData = {
  tagName: string;
  id?: string;
  path: number[];
  childCount: number;
  children: SceneNodeData[];
};

export type CodeRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type SelectedElementData = {
  tagName: string;
  id?: string;
  path: number[];
};

export type TransformValues = {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
};

export type SnappingConfig = {
  translation: number;
  rotation: number;
  scale: number;
};

export const DEFAULT_SNAPPING_CONFIG: SnappingConfig = {
  translation: 0.1,
  rotation: 10,
  scale: 0.25,
};

export type ElementPropertyData = {
  name: string;
  label: string;
  type: string;
  value: string;
  mixed?: boolean;
  step?: number;
  min?: number;
  max?: number;
  defaultValue?: string;
  options?: { label: string; value: string }[];
};

export type AttributeValue = string | number | boolean | null | undefined;
