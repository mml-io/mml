import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodeChangeVisibleTo,
  encodeChangeVisibleTo,
  NetworkedDOMV02ChangeVisibleToDiff,
} from "../../src/networked-dom-v0.2/messages/from-server/changeVisibleTo";
import { ChangeVisibleToMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02ChangeVisibleToDiff, Array<number>]> = [
  [
    "empty",
    {
      type: "changeVisibleTo",
      nodeId: 123,
      addVisibleTo: [],
      removeVisibleTo: [],
    },
    [7, 123, 0, 0],
  ],
  [
    "with add and remove",
    {
      type: "changeVisibleTo",
      nodeId: 123,
      addVisibleTo: [1, 2],
      removeVisibleTo: [3, 4],
    },
    [7, 123, 2, 1, 2, 2, 3, 4],
  ],
  [
    "large node id and large connection ids",
    {
      type: "changeVisibleTo",
      nodeId: 12345,
      addVisibleTo: [45678, 56789],
      removeVisibleTo: [67890, 78901],
    },
    [7, 185, 96, 2, 238, 228, 2, 213, 187, 3, 2, 178, 146, 4, 181, 232, 4],
  ],
];

describe("encode/decode changeVisibleTo", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeChangeVisibleTo(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(ChangeVisibleToMessageType);
    const decoded = decodeChangeVisibleTo(reader);
    expect(decoded).toEqual(message);
  });
});
