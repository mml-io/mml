/**
 * Traverse a DOM tree to find an element at a given path of child indices.
 * The path is an array of indices from the root element.
 */
export function elementAtPath(root: HTMLElement | null, path: number[]): HTMLElement | null {
  if (!root) return null;
  let current: Element = root;
  for (const index of path) {
    const child = current.children[index];
    if (!child) return null;
    current = child;
  }
  return current as HTMLElement;
}

/**
 * Get the path (array of child indices) from root to element.
 */
export function pathToElement(root: HTMLElement | null, element: HTMLElement): number[] {
  if (!root) return [];
  const path: number[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;
    const index = Array.from(parent.children).indexOf(current);
    path.unshift(index);
    current = parent;
  }
  return path;
}

/**
 * Find the body element within a remote holder element.
 * Searches recursively for an element whose tagName ends with "BODY".
 *
 * Note: In some environments the remote "body" is mounted in custom elements
 * like <m-remote-document>. As a last resort, this returns the holder itself
 * so callers can still traverse children.
 */
export function bodyFromRemoteHolderElement(remoteHolderElement: HTMLElement): HTMLElement | null {
  const findBodyElement = (element: HTMLElement): HTMLElement | null => {
    if (element.tagName.endsWith("BODY")) {
      return element;
    }

    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i] as HTMLElement;
      const result = findBodyElement(child);
      if (result) {
        return result;
      }
    }

    return null;
  };

  const body = findBodyElement(remoteHolderElement);
  if (body) return body;

  // Fallback to a remote document element if present (some environments mount the DOM there)
  const remoteDoc = remoteHolderElement.querySelector("m-remote-document") as HTMLElement | null;
  if (remoteDoc) return remoteDoc;

  // Final fallback to the holder itself so callers can still traverse children
  return remoteHolderElement;
}
