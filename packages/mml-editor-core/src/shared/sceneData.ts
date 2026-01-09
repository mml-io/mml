import { getMmlChildren } from "./mmlDom";
import type { SceneNodeData } from "./types";

export function buildSceneData(bodyElement: HTMLElement | null): SceneNodeData[] {
  if (!bodyElement) return [];
  const roots = getMmlChildren(bodyElement);
  return roots.map((el, index) => buildSceneNode(el, [index]));
}

export function buildSceneNode(element: HTMLElement, path: number[]): SceneNodeData {
  const children = getMmlChildren(element);
  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    path,
    childCount: children.length,
    children: children.map((child, index) => buildSceneNode(child, [...path, index])),
  };
}
