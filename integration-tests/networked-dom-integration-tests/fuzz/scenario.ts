import { formatHTML } from "../test/test-util";
import {
  AVAILABLE_TAGS,
  CLIENT_CONNECTION_IDS,
  FuzzNodeSpec,
  FuzzOperation,
  FuzzScenario,
  TreeNode,
} from "./fuzz-types";
import { chooseSubset, createSeededRandom, pickRandom } from "./random";
import {
  applyAddOperation,
  applyRemoveAttributeOperation,
  applyRemoveOperation,
  applySetAttributeOperation,
  cloneNode,
  renderDocumentFromTree,
  renderTreeToHTML,
} from "./tree-utils";
import { filterTreeForConnection, projectTreeForConnectionWithPlaceholders } from "./visibility";

export function createNodeSpecGenerator(
  random: () => number,
): (idPrefix: string, depth: number, maxDepth: number) => FuzzNodeSpec {
  let nodeCounter = 0;
  const randomTag = () => AVAILABLE_TAGS[Math.floor(random() * AVAILABLE_TAGS.length)];

  const buildNode = (idPrefix: string, depth: number, maxDepth: number): FuzzNodeSpec => {
    const id = `${idPrefix}-${nodeCounter++}`;
    const attributes: Record<string, string> = { id };
    if (random() > 0.6) {
      attributes["data-depth"] = depth.toString();
    }
    if (random() > 0.7) {
      attributes["data-rand"] = Math.floor(random() * 100).toString();
    }

    const node: FuzzNodeSpec = {
      tag: randomTag(),
      id,
      attributes,
      children: [],
    };

    if (depth < maxDepth) {
      const childCount = Math.floor(random() * 3);
      for (let i = 0; i < childCount; i += 1) {
        node.children.push(buildNode(idPrefix, depth + 1, maxDepth));
      }
    }

    return node;
  };

  return buildNode;
}

export function buildScenario(
  seed: number,
  operationsCount: number,
  maxDepth: number,
): FuzzScenario {
  const random = createSeededRandom(seed);
  const generateNode = createNodeSpecGenerator(random);

  let root: TreeNode = {
    id: "app",
    tag: "div",
    attributes: { id: "app", "data-root": "true" },
    children: [],
  };

  const operations: FuzzOperation[] = [];

  const getDelay = () => (random() > 0.5 ? 1 : 0);

  const collectNodes = (node: TreeNode): TreeNode[] => {
    return [node, ...node.children.flatMap((child) => collectNodes(child))];
  };

  const attributePool = [
    "data-depth",
    "data-rand",
    "class",
    "title",
    "data-info",
    "visible-to",
    "hidden-from",
  ];
  const connectionIds = CLIENT_CONNECTION_IDS;

  function generateAttributeValue(name: string): string {
    if (name === "visible-to" || name === "hidden-from") {
      const subset = chooseSubset(connectionIds, random);
      return subset.slice().sort().join(",");
    }
    if (name === "class") {
      const classes = chooseSubset(["a", "b", "c", "x", "y", "z"] as const, random);
      return classes.join(" ");
    }
    if (name === "title") {
      return `title-${Math.floor(random() * 1000)}`;
    }
    if (name === "data-info") {
      return `info-${Math.floor(random() * 1000)}`;
    }
    if (name === "data-depth") {
      return `${Math.floor(random() * (maxDepth + 2))}`;
    }
    if (name === "data-rand") {
      return `${Math.floor(random() * 1000)}`;
    }
    return `value-${Math.floor(random() * 1000)}`;
  }

  function applyRandomMutation(targetTree: TreeNode) {
    const existingNodes = collectNodes(targetTree);
    const existingNonRoot = existingNodes.filter((n) => n.id !== "app");
    const mutationKinds: Array<() => boolean> = [];

    mutationKinds.push(() => {
      const parent = pickRandom(existingNodes, random);
      const nodeSpec = generateNode("node", 0, maxDepth);
      applyAddOperation(targetTree, nodeSpec, parent.id);
      return true;
    });

    if (existingNonRoot.length > 0) {
      mutationKinds.push(() => {
        const victim = pickRandom(existingNonRoot, random);
        applyRemoveOperation(targetTree, victim.id);
        return true;
      });
    }

    mutationKinds.push(() => {
      const target = pickRandom(existingNodes, random);
      const name = pickRandom(attributePool, random);
      const value = generateAttributeValue(name);
      applySetAttributeOperation(targetTree, target.id, name, value);
      return true;
    });

    const nodesWithRemovable = existingNodes.filter((n) =>
      Object.keys(n.attributes).some((k) => k !== "id" && k !== "data-root"),
    );
    if (nodesWithRemovable.length > 0) {
      mutationKinds.push(() => {
        const t = pickRandom(nodesWithRemovable, random);
        const candidates = Object.keys(t.attributes).filter((k) => k !== "id" && k !== "data-root");
        if (candidates.length === 0) return false;
        const name = pickRandom(candidates, random);
        applyRemoveAttributeOperation(targetTree, t.id, name);
        return true;
      });
    }

    const chosen = pickRandom(mutationKinds, random);
    chosen();
  }

  while (operations.length < operationsCount) {
    const existingNodes = collectNodes(root);
    const existingIds = existingNodes.map((node) => node.id);
    const availableOperations: Array<() => boolean> = [];

    availableOperations.push(() => {
      const parentId = existingIds[Math.floor(random() * existingIds.length)];
      const nodeSpec = generateNode("node", 0, maxDepth);
      applyAddOperation(root, nodeSpec, parentId);
      operations.push({
        type: "add",
        parentId,
        node: nodeSpec,
        delayMs: getDelay(),
      });
      return true;
    });

    const removableNodes = existingNodes.filter((node) => node.id !== "app");
    if (removableNodes.length > 0) {
      availableOperations.push(() => {
        const target = removableNodes[Math.floor(random() * removableNodes.length)];
        applyRemoveOperation(root, target.id);
        operations.push({
          type: "remove",
          targetId: target.id,
          delayMs: getDelay(),
        });
        return true;
      });
    }

    availableOperations.push(() => {
      const target = existingNodes[Math.floor(random() * existingNodes.length)];
      const attribute = [
        "data-depth",
        "data-rand",
        "class",
        "title",
        "data-info",
        "visible-to",
        "hidden-from",
      ][Math.floor(random() * 7)];
      const value = generateAttributeValue(attribute);
      applySetAttributeOperation(root, target.id, attribute, value);
      operations.push({
        type: "set-attribute",
        targetId: target.id,
        name: attribute,
        value,
        delayMs: getDelay(),
      });
      return true;
    });

    const removableAttributeNodes = existingNodes.filter((node) =>
      Object.keys(node.attributes).some((key) => key !== "id" && key !== "data-root"),
    );

    if (removableAttributeNodes.length > 0) {
      availableOperations.push(() => {
        const target =
          removableAttributeNodes[Math.floor(random() * removableAttributeNodes.length)];
        const removableAttributes = Object.keys(target.attributes).filter(
          (key) => key !== "id" && key !== "data-root",
        );
        if (removableAttributes.length === 0) {
          return false;
        }
        const name = removableAttributes[Math.floor(random() * removableAttributes.length)];
        applyRemoveAttributeOperation(root, target.id, name);
        operations.push({
          type: "remove-attribute",
          targetId: target.id,
          name,
          delayMs: getDelay(),
        });
        return true;
      });
    }

    if (operations.length > 0 && random() > 0.8) {
      availableOperations.push(() => {
        const clone = cloneNode(root);
        const mutationCount = Math.max(1, Math.floor(random() * 6));
        for (let i = 0; i < mutationCount; i += 1) {
          applyRandomMutation(clone);
        }
        root = clone;
        const html = renderTreeToHTML(root);
        operations.push({
          type: "reload",
          html,
          delayMs: getDelay(),
        });
        return true;
      });
    }

    const chosenOperation = availableOperations[Math.floor(random() * availableOperations.length)];
    if (!chosenOperation()) {
      continue;
    }
  }

  const finalTree = cloneNode(root);
  const expectedDocumentHTML = formatHTML(renderDocumentFromTree(finalTree));
  const expectedClientHTMLByConnection: Record<string, string> = {};
  const expectedClientHTMLByConnectionV02: Record<string, string> = {};
  for (const connectionId of CLIENT_CONNECTION_IDS) {
    const filteredTree = filterTreeForConnection(finalTree, connectionId);
    const clientDocumentHTML = renderDocumentFromTree(filteredTree);
    const formattedClientDocument = formatHTML(clientDocumentHTML);
    expectedClientHTMLByConnection[connectionId] = formatHTML(
      `<div>${formattedClientDocument}</div>`,
    );

    const projectedTree = projectTreeForConnectionWithPlaceholders(finalTree, connectionId);
    const v02ClientDocumentHTML = renderDocumentFromTree(projectedTree);
    const v02FormattedClientDocument = formatHTML(v02ClientDocumentHTML);
    expectedClientHTMLByConnectionV02[connectionId] = formatHTML(
      `<div>${v02FormattedClientDocument}</div>`,
    );
  }

  return {
    operations,
    finalTree,
    expectedDocumentHTML,
    expectedClientHTMLByConnection,
    expectedClientHTMLByConnectionV02,
  };
}
