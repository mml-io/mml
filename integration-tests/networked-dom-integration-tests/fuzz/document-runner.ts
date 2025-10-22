import type { DeepReadonly, FuzzOperation } from "./fuzz-types";

/**
 * Creates a fuzz document with initial HTML and operations to run.
 * Operations should NOT include reload operations - those should be handled externally.
 * The document will call window.done() when all operations are complete.
 */
export function createFuzzDocument(
  initialHTML: string,
  operations: DeepReadonly<FuzzOperation[]>,
): string {
  // Filter out reload operations - they should not be in the operations list
  const nonReloadOps = operations.filter((op) => op.type !== "reload");

  return `
${initialHTML}
<script>
  const fuzzOperations = ${JSON.stringify(nonReloadOps)};
  function createNode(spec) {
    const el = document.createElement(spec.tag);
    for (const [key, value] of Object.entries(spec.attributes)) {
      el.setAttribute(key, value);
    }
    if (spec.textContent) {
      el.textContent = spec.textContent;
    }
    for (const child of spec.children) {
      el.appendChild(createNode(child));
    }
    return el;
  }
  function removeNodeById(id) {
    const el = document.getElementById(id);
    if (el && el.parentElement) {
      el.parentElement.removeChild(el);
    }
  }
  async function run() {
    await new Promise((resolve) => setTimeout(resolve, 1));
    for (const operation of fuzzOperations) {
      if (operation.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, operation.delayMs));
      }
      if (operation.type === "add") {
        const parent = document.getElementById(operation.parentId);
        if (!parent) {
          throw new Error('Parent ' + operation.parentId + ' not found');
        }
        parent.appendChild(createNode(operation.node));
      } else if (operation.type === "remove") {
        removeNodeById(operation.targetId);
      } else if (operation.type === "set-attribute") {
        const target = document.getElementById(operation.targetId);
        if (!target) {
          throw new Error('Target ' + operation.targetId + ' not found for setAttribute');
        }
        target.setAttribute(operation.name, operation.value);
      } else if (operation.type === "remove-attribute") {
        const target = document.getElementById(operation.targetId);
        if (!target) {
          throw new Error('Target ' + operation.targetId + ' not found for removeAttribute');
        }
        target.removeAttribute(operation.name);
      }
    }
    // Signal completion
    if (typeof window.done === 'function') {
      window.done();
    }
  }
  run();
</script>`;
}
