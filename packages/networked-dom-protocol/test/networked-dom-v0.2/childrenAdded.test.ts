import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodeChildrenAdded,
  encodeChildrenAdded,
  NetworkedDOMV02ChildrenAddedDiff,
} from "../../src/networked-dom-v0.2/messages/from-server/childrenAdded";
import { ChildrenAddedMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02ChildrenAddedDiff, Array<number>]> = [
  [
    "empty",
    {
      type: "childrenAdded",
      nodeId: 123,
      previousNodeId: null,
      addedNodes: [],
    },
    [4, 123, 0, 0],
  ],
  [
    "with nodes and null previousNodeId",
    {
      type: "childrenAdded",
      nodeId: 123,
      previousNodeId: null,
      addedNodes: [
        {
          type: "element",
          nodeId: 234,
          tag: "m-cube",
          attributes: [
            ["color", "red"],
            ["width", "5"],
          ],
          children: [
            {
              type: "element",
              nodeId: 2345,
              tag: "m-cube",
              attributes: [
                ["color", "green"],
                ["width", "7"],
              ],
              children: [],
            },
          ],
        },
        {
          type: "element",
          nodeId: 456,
          tag: "m-sphere",
          attributes: [],
          children: [],
        },
      ],
    },
    [
      4, 123, 0, 2, 234, 1, 6, 109, 45, 99, 117, 98, 101, 2, 10, 99, 111, 108, 111, 114, 3, 114,
      101, 100, 10, 119, 105, 100, 116, 104, 1, 53, 0, 0, 1, 169, 18, 6, 109, 45, 99, 117, 98, 101,
      2, 10, 99, 111, 108, 111, 114, 5, 103, 114, 101, 101, 110, 10, 119, 105, 100, 116, 104, 1, 55,
      0, 0, 0, 200, 3, 8, 109, 45, 115, 112, 104, 101, 114, 101, 0, 0, 0, 0,
    ],
  ],
  [
    "with nodes id, large previousNodeId, and visibleTo and hiddenFrom",
    {
      type: "childrenAdded",
      nodeId: 123,
      previousNodeId: 987654321,
      addedNodes: [
        {
          type: "element",
          nodeId: 234,
          tag: "m-cube",
          attributes: [
            ["color", "red"],
            ["width", "5"],
          ],
          visibleTo: [123, 456, 789],
          hiddenFrom: [987, 654, 321],
          children: [
            {
              type: "element",
              nodeId: 2345,
              tag: "m-cube",
              attributes: [
                ["color", "green"],
                ["width", "7"],
              ],
              children: [],
            },
          ],
        },
        {
          type: "element",
          nodeId: 456,
          tag: "m-sphere",
          attributes: [],
          children: [],
          visibleTo: [123, 456, 789],
          hiddenFrom: [987, 654, 321],
        },
      ],
    },
    [
      4, 123, 177, 209, 249, 214, 3, 2, 234, 1, 6, 109, 45, 99, 117, 98, 101, 2, 10, 99, 111, 108,
      111, 114, 3, 114, 101, 100, 10, 119, 105, 100, 116, 104, 1, 53, 3, 123, 200, 3, 149, 6, 3,
      219, 7, 142, 5, 193, 2, 1, 169, 18, 6, 109, 45, 99, 117, 98, 101, 2, 10, 99, 111, 108, 111,
      114, 5, 103, 114, 101, 101, 110, 10, 119, 105, 100, 116, 104, 1, 55, 0, 0, 0, 200, 3, 8, 109,
      45, 115, 112, 104, 101, 114, 101, 0, 3, 123, 200, 3, 149, 6, 3, 219, 7, 142, 5, 193, 2, 0,
    ],
  ],
];

describe("encode/decode childrenAdded", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeChildrenAdded(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(ChildrenAddedMessageType);
    const decoded = decodeChildrenAdded(reader);
    expect(decoded).toEqual(message);
  });
});
