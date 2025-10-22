import type { TreeNode } from "./fuzz-types";

function parseConnectionList(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

export function filterTreeForConnection(node: TreeNode, connectionId: string): TreeNode | null {
  const visibleTo = parseConnectionList(node.attributes["visible-to"]);
  if (visibleTo.size > 0 && !visibleTo.has(connectionId)) {
    return null;
  }

  const hiddenFrom = parseConnectionList(node.attributes["hidden-from"]);
  if (hiddenFrom.has(connectionId)) {
    return null;
  }

  const filteredChildren = node.children
    .map((child) => filterTreeForConnection(child, connectionId))
    .filter((child): child is TreeNode => child !== null);

  const { ...restAttributes } = node.attributes;

  delete restAttributes["visible-to"];
  delete restAttributes["hidden-from"];

  return {
    id: node.id,
    tag: node.tag,
    attributes: { ...restAttributes },
    children: filteredChildren,
    textContent: node.textContent,
  };
}

export function projectTreeForConnectionWithPlaceholders(
  node: TreeNode,
  connectionId: string,
): TreeNode | null {
  const visibleTo = parseConnectionList(node.attributes["visible-to"]);
  const hiddenFrom = parseConnectionList(node.attributes["hidden-from"]);

  // First, project children for this connection
  const filteredChildren = node.children
    .map((child) => projectTreeForConnectionWithPlaceholders(child, connectionId))
    .filter((child): child is TreeNode => child !== null);

  // v0.2 semantics:
  // - If element is explicitly hidden-from this connection, render an empty <x-hidden> placeholder.
  if (hiddenFrom.has(connectionId)) {
    return {
      id: node.id,
      tag: "x-hidden",
      attributes: {},
      children: [],
    };
  }
  // - If element has a visible-to list that does not include this connection, omit it entirely (no placeholder).
  if (visibleTo.size > 0 && !visibleTo.has(connectionId)) {
    return null;
  }

  const { ...restAttributes } = node.attributes;

  delete restAttributes["visible-to"];
  delete restAttributes["hidden-from"];

  return {
    id: node.id,
    tag: node.tag,
    attributes: { ...restAttributes },
    children: filteredChildren,
    textContent: node.textContent,
  };
}
