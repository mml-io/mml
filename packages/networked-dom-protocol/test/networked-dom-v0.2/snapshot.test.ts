import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodeSnapshot,
  encodeSnapshot,
  NetworkedDOMV02SnapshotMessage,
} from "../../src/networked-dom-v0.2/messages/from-server/snapshot";
import { SnapshotMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02SnapshotMessage, Array<number>]> = [
  [
    "with nodes and no visibleTo or hiddenFrom",
    {
      type: "snapshot",
      documentTime: 1735732759569,
      snapshot: {
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
    },
    [
      1, 234, 1, 6, 109, 45, 99, 117, 98, 101, 2, 10, 99, 111, 108, 111, 114, 3, 114, 101, 100, 10,
      119, 105, 100, 116, 104, 1, 53, 0, 0, 1, 169, 18, 6, 109, 45, 99, 117, 98, 101, 2, 10, 99,
      111, 108, 111, 114, 5, 103, 114, 101, 101, 110, 10, 119, 105, 100, 116, 104, 1, 55, 0, 0, 0,
      145, 152, 240, 141, 194, 50,
    ],
  ],
  [
    "with visibleTo and hiddenFrom",
    {
      type: "snapshot",
      documentTime: 1735732759569,
      snapshot: {
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
    },
    [
      1, 234, 1, 6, 109, 45, 99, 117, 98, 101, 2, 10, 99, 111, 108, 111, 114, 3, 114, 101, 100, 10,
      119, 105, 100, 116, 104, 1, 53, 3, 123, 200, 3, 149, 6, 3, 219, 7, 142, 5, 193, 2, 1, 169, 18,
      6, 109, 45, 99, 117, 98, 101, 2, 10, 99, 111, 108, 111, 114, 5, 103, 114, 101, 101, 110, 10,
      119, 105, 100, 116, 104, 1, 55, 0, 0, 0, 145, 152, 240, 141, 194, 50,
    ],
  ],
];

describe("encode/decode snapshot", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeSnapshot(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(SnapshotMessageType);
    const decoded = decodeSnapshot(reader);
    expect(decoded).toEqual(message);
  });
});
