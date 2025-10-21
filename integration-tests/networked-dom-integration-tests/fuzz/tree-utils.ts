import type { FuzzNodeSpec, TreeNode } from "./fuzz-types";

export function cloneNode(node: TreeNode): TreeNode {
  return {
    id: node.id,
    tag: node.tag,
    attributes: { ...node.attributes },
    children: node.children.map(cloneNode),
    textContent: node.textContent,
  };
}

export function applyAddOperation(tree: TreeNode, nodeSpec: FuzzNodeSpec, parentId: string) {
  const parent = findNode(tree, parentId);
  if (!parent) {
    throw new Error(`Parent with id ${parentId} not found`);
  }
  const node = convertSpecToTree(nodeSpec);
  parent.children.push(node);
}

export function applyRemoveOperation(tree: TreeNode, targetId: string) {
  if (tree.id === targetId) {
    throw new Error(`Cannot remove root node ${targetId}`);
  }
  removeNodeRecursive(tree, targetId);
}

export function applySetAttributeOperation(
  tree: TreeNode,
  targetId: string,
  name: string,
  value: string,
) {
  const target = findNode(tree, targetId);
  if (!target) {
    throw new Error(`Target with id ${targetId} not found for setAttribute`);
  }
  target.attributes[name] = value;
}

export function applyRemoveAttributeOperation(tree: TreeNode, targetId: string, name: string) {
  const target = findNode(tree, targetId);
  if (!target) {
    throw new Error(`Target with id ${targetId} not found for removeAttribute`);
  }
  delete target.attributes[name];
}

function removeNodeRecursive(node: TreeNode, targetId: string): boolean {
  const index = node.children.findIndex((child) => child.id === targetId);
  if (index !== -1) {
    node.children.splice(index, 1);
    return true;
  }
  for (const child of node.children) {
    if (removeNodeRecursive(child, targetId)) {
      return true;
    }
  }
  return false;
}

export function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) {
    return node;
  }
  for (const child of node.children) {
    const result = findNode(child, id);
    if (result) {
      return result;
    }
  }
  return null;
}

function convertSpecToTree(spec: FuzzNodeSpec): TreeNode {
  return {
    id: spec.id,
    tag: spec.tag,
    attributes: { ...spec.attributes },
    children: spec.children.map(convertSpecToTree),
    textContent: spec.textContent,
  };
}

export function renderTreeToHTML(node: TreeNode): string {
  const attributes = Object.entries(node.attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const childrenHTML = node.children.map((child) => renderTreeToHTML(child)).join("");
  const textContent = node.textContent ? escapeHtml(node.textContent) : "";
  const attributeString = attributes.length > 0 ? ` ${attributes}` : "";
  return `<${node.tag}${attributeString}>${textContent}${childrenHTML}</${node.tag}>`;
}

export function renderDocumentFromTree(tree: TreeNode | null): string {
  const bodyContent = tree ? renderTreeToHTML(tree) : "";
  return `<html><head></head><body>${bodyContent}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
