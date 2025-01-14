import {
  NetworkedDOMV02ChildrenAddedDiff,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";

export function prepareData(size: number): Array<NetworkedDOMV02ServerMessage> {
  const data: Array<NetworkedDOMV02ChildrenAddedDiff> = [];
  for (let i = 0; i < size; i++) {
    data.push({
      type: "childrenAdded",
      nodeId: i + 1,
      previousNodeId: i + 2,
      addedNodes: [
        {
          type: "element",
          nodeId: i + 3,
          tag: "m-cube",
          attributes: [
            ["color" + i, "red"],
            ["x", "1"],
            ["y", "2"],
            ["z", "3"],
          ],
          children: [
            {
              type: "element",
              nodeId: i + 4,
              tag: "m-cube",
              attributes: [
                ["color" + i, "blue"],
                ["x" + i, "4"],
                ["y", "5"],
                ["z", "6"],
                ["rx" + i, "4"],
                ["ry", "5"],
                ["rz", "6"],
              ],
              children: [],
            },
            {
              type: "element",
              nodeId: i + 5,
              tag: "m-cube",
              attributes: [
                ["color" + i, "blue"],
                ["x" + i, "4"],
                ["y", "5"],
                ["z", "6"],
                ["rx" + i, "4"],
                ["ry", "5"],
                ["rz", "6"],
              ],
              children: [],
            },
            {
              type: "element",
              nodeId: i + 6,
              tag: "m-cube",
              attributes: [
                ["empty", ""],
                ["color" + i, "blue"],
                ["x" + i, "4"],
                ["y", "5"],
                ["z", "6"],
                ["rx" + i, "4"],
                ["ry", "5"],
                ["rz", "6"],
              ],
              children: [],
            },
          ],
        },
      ],
    });
  }
  return data;
}
