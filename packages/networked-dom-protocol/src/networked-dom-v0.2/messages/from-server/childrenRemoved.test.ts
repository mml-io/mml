import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { ChildrenRemovedMessageType } from "../../messageTypes";
import {
  decodeChildrenRemoved,
  encodeChildrenRemoved,
  NetworkedDOMV02ChildrenRemovedDiff,
} from "./childrenRemoved";

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
