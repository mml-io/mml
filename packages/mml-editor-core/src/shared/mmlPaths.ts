import { getMmlChildren } from "./mmlDom";
import { bodyFromRemoteHolderElement } from "./remoteHolderUtils";

/**
 * MML element paths are arrays of indices into the filtered list of *MML element* children.
 * This keeps paths stable even when non-MML nodes are present in the DOM.
 */

export function pathsEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function pathExistsIn(path: number[], paths: number[][]) {
  return paths.some((p) => pathsEqual(p, path));
}

export function removePath(path: number[], paths: number[][]) {
  return paths.filter((p) => !pathsEqual(p, path));
}

export function elementToMmlPath(remoteHolder: HTMLElement, element: HTMLElement): number[] {
  const root = bodyFromRemoteHolderElement(remoteHolder);
  if (!root) return [];

  const path: number[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== root && current.parentElement) {
    const siblings = getMmlChildren(current.parentElement);
    const index = siblings.indexOf(current);
    if (index !== -1) {
      path.unshift(index);
    }
    current = current.parentElement;
  }

  return path;
}

export function mmlPathToElement(root: HTMLElement | null, path: number[]): HTMLElement | null {
  if (!root) return null;

  let current: HTMLElement = root;
  for (const index of path) {
    const children = getMmlChildren(current);
    if (index < 0 || index >= children.length) return null;
    current = children[index];
  }

  return current === root ? null : current;
}

export function resolveMmlPathsToElements(
  remoteHolder: HTMLElement | null,
  paths: number[][],
): HTMLElement[] {
  if (!remoteHolder) return [];
  const root = bodyFromRemoteHolderElement(remoteHolder);
  if (!root) return [];

  return paths.map((p) => mmlPathToElement(root, p)).filter((el): el is HTMLElement => !!el);
}
