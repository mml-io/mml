import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { DisconnectUsersMessageType } from "../../messageTypes";
import {
  decodeDisconnectUsers,
  encodeDisconnectUsers,
  NetworkedDOMV02DisconnectUsersMessage,
} from "./disconnectUsers";

const cases: Array<[string, NetworkedDOMV02DisconnectUsersMessage, Array<number>]> = [
  [
    "empty connection list",
    {
      type: "disconnectUsers",
      connectionIds: [],
    },
    [15, 0],
  ],
  [
    "single connection",
    {
      type: "disconnectUsers",
      connectionIds: [123],
    },
    [15, 1, 123],
  ],
  [
    "multiple connections",
    {
      type: "disconnectUsers",
      connectionIds: [123, 456, 789],
    },
    [15, 3, 123, 200, 3, 149, 6],
  ],
  [
    "large connection IDs",
    {
      type: "disconnectUsers",
      connectionIds: [12345, 67890, 1234567890],
    },
    [15, 3, 185, 96, 178, 146, 4, 210, 133, 216, 204, 4],
  ],
];

describe("encode/decode disconnectUsers", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(64);
    encodeDisconnectUsers(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(DisconnectUsersMessageType);
    const decoded = decodeDisconnectUsers(reader);
    expect(decoded).toEqual(message);
  });
});
