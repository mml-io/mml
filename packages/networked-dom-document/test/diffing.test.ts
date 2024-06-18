import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import { VirtualDOMDiffStruct } from "../src/common";
import { calculateStaticVirtualDOMDiff } from "../src/diffing";
import { applyPatch } from "../src/rfc6902";

function checkTreeForDuplicateNodes(state: StaticVirtualDOMElement) {
  const nodeSet = new Set<number>();

  function traverseTree(node: StaticVirtualDOMElement) {
    if (nodeSet.has(node.nodeId)) {
      throw new Error(`Duplicate node with id ${node.nodeId} found`);
    }
    nodeSet.add(node.nodeId);
    node.childNodes.forEach((childNode) => traverseTree(childNode));
  }

  traverseTree(state);
}

function runTestCase(
  initialState: StaticVirtualDOMElement,
  expectedState: StaticVirtualDOMElement,
  expectedDiff: VirtualDOMDiffStruct,
) {
  const virtualDOMDiff = calculateStaticVirtualDOMDiff(initialState, expectedState);
  expect(virtualDOMDiff).toEqual(expectedDiff);

  for (const diff of virtualDOMDiff.virtualDOMDiffs) {
    const patchErrors = applyPatch(initialState, [diff]);
    expect(patchErrors).toEqual([null]);
    checkTreeForDuplicateNodes(initialState);
  }

  expect(initialState).toEqual(expectedState);
}

describe("calculateStaticVirtualDOMDiff", () => {
  describe("attribute changes", () => {
    test("attribute replacement", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red" },
        childNodes: [],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "green" },
        childNodes: [],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/attributes/color",
            value: "green",
          },
        ],
      });
    });

    test("attribute addition", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red" },
        childNodes: [],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red", size: "large" },
        childNodes: [],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "add",
            path: "/attributes/size",
            value: "large",
          },
        ],
      });
    });

    test("attribute removal", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red", size: "large" },
        childNodes: [],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red" },
        childNodes: [],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "remove",
            path: "/attributes/size",
          },
        ],
      });
    });

    test("nested groups and attributes modifications", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 4,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "yellow" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 4,
            tag: "m-sphere",
            attributes: { color: "green" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0/childNodes/0/attributes/color",
            value: "yellow",
          },
          {
            op: "replace",
            path: "/childNodes/1/attributes/color",
            value: "green",
          },
        ],
      });
    });

    test("nested attribute and child replacement", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red", size: "large" },
            childNodes: [
              {
                nodeId: 3,
                tag: "m-sphere",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "green", size: "small" },
            childNodes: [
              {
                nodeId: 3,
                tag: "m-sphere",
                attributes: { color: "yellow" },
                childNodes: [],
              },
            ],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0/attributes/color",
            value: "green",
          },
          {
            op: "replace",
            path: "/childNodes/0/attributes/size",
            value: "small",
          },
          {
            op: "replace",
            path: "/childNodes/0/childNodes/0/attributes/color",
            value: "yellow",
          },
        ],
      });
    });
  });

  describe("text content changes", () => {
    test("text content replacement", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "div",
        textContent: "Hello",
        attributes: {},
        childNodes: [],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "div",
        textContent: "World",
        attributes: {},
        childNodes: [],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/textContent",
            value: "World",
          },
        ],
      });
    });
  });

  describe("node changes", () => {
    test("tag non-replacement", () => {
      // Tags cannot be swapped on an existing node so elements must be replaced
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-sphere",
            attributes: { color: "green" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "green",
              },
              childNodes: [],
              nodeId: 2,
              tag: "m-sphere",
            },
          },
        ],
      });
    });

    test("child replacement", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red" },
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "green" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-cube",
        attributes: { color: "red" },
        childNodes: [
          {
            nodeId: 2,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 2,
              tag: "m-sphere",
            },
          },
        ],
      });
    });

    test("multiple children replacement", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "green" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-cube",
            attributes: { color: "yellow" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 2,
              tag: "m-sphere",
            },
          },
          {
            op: "replace",
            path: "/childNodes/1",
            value: {
              attributes: {
                color: "yellow",
              },
              childNodes: [],
              nodeId: 3,
              tag: "m-cube",
            },
          },
        ],
      });
    });

    test("adding additional m-group layer", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 4,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 2,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
              {
                nodeId: 3,
                tag: "m-sphere",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
        ],
      };

      const virtualDOMDiff = calculateStaticVirtualDOMDiff(initialState, expectedState);

      for (const diff of virtualDOMDiff.virtualDOMDiffs) {
        const patchErrors = applyPatch(initialState, [diff]);
        expect(patchErrors).toEqual([null]);
        checkTreeForDuplicateNodes(initialState);
      }

      expect(initialState).toEqual(expectedState);

      expect(virtualDOMDiff).toEqual({
        nodeIdRemappings: [
          {
            clientFacingNodeId: 5,
            internalNodeId: 3,
          },
        ],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {},
              childNodes: [
                {
                  attributes: {
                    color: "red",
                  },
                  childNodes: [],
                  nodeId: 2,
                  tag: "m-cube",
                },
                {
                  attributes: {
                    color: "blue",
                  },
                  childNodes: [],
                  nodeId: 5,
                  tag: "m-sphere",
                },
              ],
              nodeId: 4,
              tag: "m-group",
            },
          },
          {
            op: "remove",
            path: "/childNodes/1",
          },
        ],
      });
    });

    test("removing an m-group layer", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 4,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 2,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
              {
                nodeId: 3,
                tag: "m-sphere",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "red",
              },
              childNodes: [],
              nodeId: 2,
              tag: "m-cube",
            },
          },
          {
            op: "add",
            path: "/childNodes/-",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 3,
              tag: "m-sphere",
            },
          },
        ],
      });
    });

    test("switch order of node ids of different tags causes replacement", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [
          {
            internalNodeId: 3,
            clientFacingNodeId: 4,
          },
        ],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "add",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 4,
              tag: "m-sphere",
            },
          },
          {
            op: "remove",
            path: "/childNodes/2",
          },
        ],
      });
    });

    test("removing m-group wrapper to flatten", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
              {
                nodeId: 4,
                tag: "m-sphere",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 5,
            tag: "m-label",
            attributes: { text: "Hello" },
            childNodes: [],
          },
        ],
      };

      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
          {
            nodeId: 4,
            tag: "m-label",
            attributes: { text: "Hello" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "red",
              },
              childNodes: [],
              nodeId: 2,
              tag: "m-cube",
            },
          },
          {
            op: "replace",
            path: "/childNodes/1",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 3,
              tag: "m-sphere",
            },
          },
          {
            op: "add",
            path: "/childNodes/-",
            value: {
              attributes: {
                text: "Hello",
              },
              childNodes: [],
              nodeId: 4,
              tag: "m-label",
            },
          },
        ],
      });
    });

    test("multiple nested tag changes inside m-group", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-sphere",
            attributes: { color: "blue" },
            childNodes: [],
          },
          {
            nodeId: 4,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 5,
                tag: "m-cylinder",
                attributes: { color: "green" },
                childNodes: [],
              },
            ],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-sphere",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-cube",
            attributes: { color: "blue" },
            childNodes: [],
          },
          {
            nodeId: 4,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 5,
                tag: "m-label",
                attributes: { color: "green" },
                childNodes: [],
              },
            ],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0",
            value: {
              attributes: {
                color: "red",
              },
              childNodes: [],
              nodeId: 2,
              tag: "m-sphere",
            },
          },
          {
            op: "replace",
            path: "/childNodes/1",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 3,
              tag: "m-cube",
            },
          },
          {
            op: "replace",
            path: "/childNodes/2/childNodes/0",
            value: {
              attributes: {
                color: "green",
              },
              childNodes: [],
              nodeId: 5,
              tag: "m-label",
            },
          },
        ],
      });
    });

    test("complex nested structure with multiple changes", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
              {
                nodeId: 4,
                tag: "m-sphere",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 5,
            tag: "m-cylinder",
            attributes: { color: "green" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "yellow" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 4,
            tag: "m-sphere",
            attributes: { color: "purple" },
            childNodes: [],
          },
          {
            nodeId: 5,
            tag: "m-cylinder",
            attributes: { color: "orange" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0/childNodes/0/attributes/color",
            value: "yellow",
          },
          {
            op: "remove",
            path: "/childNodes/0/childNodes/1",
          },
          {
            op: "replace",
            path: "/childNodes/1",
            value: {
              attributes: {
                color: "purple",
              },
              childNodes: [],
              nodeId: 4,
              tag: "m-sphere",
            },
          },
          {
            op: "add",
            path: "/childNodes/-",
            value: {
              attributes: {
                color: "orange",
              },
              childNodes: [],
              nodeId: 5,
              tag: "m-cylinder",
            },
          },
        ],
      });
    });

    test("complex nested structure with multiple changes and attributes", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: { id: "group1" },
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red", size: "large" },
                childNodes: [],
              },
              {
                nodeId: 4,
                tag: "m-sphere",
                attributes: { color: "blue", radius: "5" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 5,
            tag: "m-cylinder",
            attributes: { color: "green", height: "10" },
            childNodes: [],
          },
        ],
      };

      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: { id: "group2" },
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "yellow", size: "small" },
                childNodes: [],
              },
              {
                nodeId: 4,
                tag: "m-sphere",
                attributes: { color: "purple", radius: "7" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 5,
            tag: "m-cylinder",
            attributes: { color: "orange", height: "12" },
            childNodes: [],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "replace",
            path: "/childNodes/0/attributes/id",
            value: "group2",
          },
          {
            op: "replace",
            path: "/childNodes/0/childNodes/0/attributes/color",
            value: "yellow",
          },
          {
            op: "replace",
            path: "/childNodes/0/childNodes/0/attributes/size",
            value: "small",
          },
          {
            op: "replace",
            path: "/childNodes/0/childNodes/1/attributes/color",
            value: "purple",
          },
          {
            op: "replace",
            path: "/childNodes/0/childNodes/1/attributes/radius",
            value: "7",
          },
          {
            op: "replace",
            path: "/childNodes/1/attributes/color",
            value: "orange",
          },
          {
            op: "replace",
            path: "/childNodes/1/attributes/height",
            value: "12",
          },
        ],
      });
    });
  });

  describe("nodeIdRemappings", () => {
    test("switch order of node ids of same tag causes node id remapping", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 3,
            tag: "m-cube",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 3,
            tag: "m-cube",
            attributes: { color: "red" },
            childNodes: [],
          },
          {
            nodeId: 2,
            tag: "m-cube",
            attributes: { color: "blue" },
            childNodes: [],
          },
        ],
      };

      const expectedDiff = {
        nodeIdRemappings: [
          {
            internalNodeId: 3,
            clientFacingNodeId: 2,
          },
          {
            internalNodeId: 2,
            clientFacingNodeId: 3,
          },
        ],
        originalState: initialState,
        virtualDOMDiffs: [],
      };

      // There are no diffs because the only operations are the node id remappings
      const virtualDOMDiff = calculateStaticVirtualDOMDiff(initialState, expectedState);
      expect(virtualDOMDiff).toEqual(expectedDiff);
    });

    test("nested groups with nodeIdRemappings", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
              {
                nodeId: 4,
                tag: "m-cube",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 4,
                tag: "m-cube",
                attributes: { color: "blue" },
                childNodes: [],
              },
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
            ],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [
          {
            clientFacingNodeId: 5,
            internalNodeId: 4,
          },
        ],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "add",
            path: "/childNodes/0/childNodes/0",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 5,
              tag: "m-cube",
            },
          },
          {
            op: "remove",
            path: "/childNodes/0/childNodes/2",
          },
        ],
      });
    });

    test("deeply nested structure with nodeIdRemappings", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-group",
                attributes: {},
                childNodes: [
                  {
                    nodeId: 4,
                    tag: "m-cube",
                    attributes: { color: "red" },
                    childNodes: [],
                  },
                  {
                    nodeId: 5,
                    tag: "m-cube",
                    attributes: { color: "blue" },
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-group",
                attributes: {},
                childNodes: [
                  {
                    nodeId: 5,
                    tag: "m-cube",
                    attributes: { color: "blue" },
                    childNodes: [],
                  },
                  {
                    nodeId: 4,
                    tag: "m-cube",
                    attributes: { color: "red" },
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [
          {
            clientFacingNodeId: 6,
            internalNodeId: 5,
          },
        ],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "add",
            path: "/childNodes/0/childNodes/0/childNodes/0",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 6,
              tag: "m-cube",
            },
          },
          {
            op: "remove",
            path: "/childNodes/0/childNodes/0/childNodes/2",
          },
        ],
      });
    });

    test("multiple nested groups with nodeIdRemappings", () => {
      const initialState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
              {
                nodeId: 4,
                tag: "m-cube",
                attributes: { color: "blue" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 5,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 6,
                tag: "m-cube",
                attributes: { color: "green" },
                childNodes: [],
              },
              {
                nodeId: 7,
                tag: "m-cube",
                attributes: { color: "yellow" },
                childNodes: [],
              },
            ],
          },
        ],
      };
      const expectedState: StaticVirtualDOMElement = {
        nodeId: 1,
        tag: "m-group",
        attributes: {},
        childNodes: [
          {
            nodeId: 2,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 4,
                tag: "m-cube",
                attributes: { color: "blue" },
                childNodes: [],
              },
              {
                nodeId: 3,
                tag: "m-cube",
                attributes: { color: "red" },
                childNodes: [],
              },
            ],
          },
          {
            nodeId: 5,
            tag: "m-group",
            attributes: {},
            childNodes: [
              {
                nodeId: 7,
                tag: "m-cube",
                attributes: { color: "yellow" },
                childNodes: [],
              },
              {
                nodeId: 6,
                tag: "m-cube",
                attributes: { color: "green" },
                childNodes: [],
              },
            ],
          },
        ],
      };

      runTestCase(initialState, expectedState, {
        nodeIdRemappings: [
          {
            clientFacingNodeId: 8,
            internalNodeId: 4,
          },
          {
            clientFacingNodeId: 9,
            internalNodeId: 7,
          },
        ],
        originalState: initialState,
        virtualDOMDiffs: [
          {
            op: "add",
            path: "/childNodes/0/childNodes/0",
            value: {
              attributes: {
                color: "blue",
              },
              childNodes: [],
              nodeId: 8,
              tag: "m-cube",
            },
          },
          {
            op: "remove",
            path: "/childNodes/0/childNodes/2",
          },
          {
            op: "add",
            path: "/childNodes/1/childNodes/0",
            value: {
              attributes: {
                color: "yellow",
              },
              childNodes: [],
              nodeId: 9,
              tag: "m-cube",
            },
          },
          {
            op: "remove",
            path: "/childNodes/1/childNodes/2",
          },
        ],
      });
    });
  });
});
