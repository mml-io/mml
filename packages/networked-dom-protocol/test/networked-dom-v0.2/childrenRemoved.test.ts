import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodeChildrenRemoved,
  encodeChildrenRemoved,
  NetworkedDOMV02ChildrenRemovedDiff,
} from "../../src/networked-dom-v0.2/messages/from-server/childrenRemoved";
import { ChildrenRemovedMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02ChildrenRemovedDiff, Array<number>]> = [
  [
    "empty",
    {
      type: "childrenRemoved",
      nodeId: 123,
      removedNodes: [],
    },
    [5, 123, 0],
  ],
  [
    "with large nodeId and large removedNodes",
    {
      type: "childrenRemoved",
      nodeId: 12356,
      removedNodes: [23456, 34567],
    },
    [5, 196, 96, 2, 160, 183, 1, 135, 142, 2],
  ],
];

describe("encode/decode childrenRemoved", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeChildrenRemoved(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(ChildrenRemovedMessageType);
    const decoded = decodeChildrenRemoved(reader);
    expect(decoded).toEqual(message);
  });
});
