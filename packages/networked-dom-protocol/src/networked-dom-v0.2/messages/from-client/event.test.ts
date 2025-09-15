import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { EventMessageType } from "../../messageTypes";
import { decodeEvent, encodeEvent, NetworkedDOMV02RemoteEvent } from "./event";

const cases: Array<[string, NetworkedDOMV02RemoteEvent, Array<number>]> = [
  [
    "simple click event",
    {
      type: "event",
      connectionId: 123,
      nodeId: 456,
      name: "click",
      bubbles: true,
      params: {},
    },
    [16, 200, 3, 123, 5, 99, 108, 105, 99, 107, 1, 2, 123, 125],
  ],
  [
    "event with no bubbles",
    {
      type: "event",
      connectionId: 1,
      nodeId: 2,
      name: "hover",
      bubbles: false,
      params: { x: 100, y: 200 },
    },
    [
      16, 2, 1, 5, 104, 111, 118, 101, 114, 0, 17, 123, 34, 120, 34, 58, 49, 48, 48, 44, 34, 121,
      34, 58, 50, 48, 48, 125,
    ],
  ],
  [
    "event with complex params",
    {
      type: "event",
      connectionId: 42,
      nodeId: 100,
      name: "custom",
      bubbles: true,
      params: {
        data: "test",
        numbers: [1, 2, 3],
        nested: { key: "value" },
      },
    },
    [
      16, 100, 42, 6, 99, 117, 115, 116, 111, 109, 1, 58, 123, 34, 100, 97, 116, 97, 34, 58, 34,
      116, 101, 115, 116, 34, 44, 34, 110, 117, 109, 98, 101, 114, 115, 34, 58, 91, 49, 44, 50, 44,
      51, 93, 44, 34, 110, 101, 115, 116, 101, 100, 34, 58, 123, 34, 107, 101, 121, 34, 58, 34, 118,
      97, 108, 117, 101, 34, 125, 125,
    ],
  ],
  [
    "event with null params",
    {
      type: "event",
      connectionId: 1,
      nodeId: 1,
      name: "test",
      bubbles: false,
      params: null,
    },
    [16, 1, 1, 4, 116, 101, 115, 116, 0, 4, 110, 117, 108, 108],
  ],
  [
    "large connection and node IDs",
    {
      type: "event",
      connectionId: 12345,
      nodeId: 67890,
      name: "bigEvent",
      bubbles: true,
      params: { big: true },
    },
    [
      16, 178, 146, 4, 185, 96, 8, 98, 105, 103, 69, 118, 101, 110, 116, 1, 12, 123, 34, 98, 105,
      103, 34, 58, 116, 114, 117, 101, 125,
    ],
  ],
];

describe("encode/decode event", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(128);
    encodeEvent(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(EventMessageType);
    const decoded = decodeEvent(reader);
    expect(decoded).toEqual(message);
  });
});
