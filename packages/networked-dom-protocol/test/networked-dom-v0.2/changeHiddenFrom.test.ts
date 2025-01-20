import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodeChangeHiddenFrom,
  encodeChangeHiddenFrom,
  NetworkedDOMV02ChangeHiddenFromDiff,
} from "../../src/networked-dom-v0.2/messages/from-server/changeHiddenFrom";
import { ChangeHiddenFromMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02ChangeHiddenFromDiff, Array<number>]> = [
  [
    "empty",
    {
      type: "changeHiddenFrom",
      nodeId: 123,
      addHiddenFrom: [],
      removeHiddenFrom: [],
    },
    [8, 123, 0, 0],
  ],
  [
    "with add and remove",
    {
      type: "changeHiddenFrom",
      nodeId: 123,
      addHiddenFrom: [1, 2],
      removeHiddenFrom: [3, 4],
    },
    [8, 123, 2, 1, 2, 2, 3, 4],
  ],
  [
    "large node id and large connection ids",
    {
      type: "changeHiddenFrom",
      nodeId: 12345,
      addHiddenFrom: [45678, 56789],
      removeHiddenFrom: [67890, 78901],
    },
    [8, 185, 96, 2, 238, 228, 2, 213, 187, 3, 2, 178, 146, 4, 181, 232, 4],
  ],
];

describe("encode/decode changeHiddenFrom", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeChangeHiddenFrom(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(ChangeHiddenFromMessageType);
    const decoded = decodeChangeHiddenFrom(reader);
    expect(decoded).toEqual(message);
  });
});
