import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import {
  getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow,
  networkedDOMProtocolSubProtocol_v0_2,
  networkedDOMProtocolSubProtocol_v0_2_1,
  networkedDOMProtocolSubProtocol_v0_2_SubversionNumber,
} from "../../constants";
import { ConnectUsersMessageType } from "../../messageTypes";
import {
  decodeConnectUsers,
  encodeConnectUsers,
  NetworkedDOMV02ConnectUsersMessage,
} from "./connectUsers";

const cases: Array<
  [
    string,
    NetworkedDOMV02ConnectUsersMessage,
    networkedDOMProtocolSubProtocol_v0_2_SubversionNumber,
    Array<number>,
  ]
> = [
  [
    "empty connection list",
    {
      type: "connectUsers",
      connectionIds: [],
      connectionTokens: [],
    },
    getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      networkedDOMProtocolSubProtocol_v0_2_1,
    ),
    [14, 0],
  ],
  [
    "single connection without token (v0.2.0)",
    {
      type: "connectUsers",
      connectionIds: [123],
      connectionTokens: [null],
    },
    getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(networkedDOMProtocolSubProtocol_v0_2),
    [14, 1, 123],
  ],
  [
    "single connection with null token (v0.2.1+)",
    {
      type: "connectUsers",
      connectionIds: [123],
      connectionTokens: [null],
    },
    getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      networkedDOMProtocolSubProtocol_v0_2_1,
    ),
    [14, 1, 123, 0],
  ],
  [
    "single connection with token (v0.2.1+)",
    {
      type: "connectUsers",
      connectionIds: [123],
      connectionTokens: ["token123"],
    },
    getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      networkedDOMProtocolSubProtocol_v0_2_1,
    ),
    [14, 1, 123, 8, 116, 111, 107, 101, 110, 49, 50, 51],
  ],
  [
    "multiple connections with mixed tokens (v0.2.1+)",
    {
      type: "connectUsers",
      connectionIds: [123, 456, 789],
      connectionTokens: ["token1", null, "token3"],
    },
    getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      networkedDOMProtocolSubProtocol_v0_2_1,
    ),
    [14, 3, 123, 200, 3, 149, 6, 6, 116, 111, 107, 101, 110, 49, 0, 6, 116, 111, 107, 101, 110, 51],
  ],
  [
    "large connection IDs",
    {
      type: "connectUsers",
      connectionIds: [12345, 67890],
      connectionTokens: [null, null],
    },
    getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      networkedDOMProtocolSubProtocol_v0_2_1,
    ),
    [14, 2, 185, 96, 178, 146, 4, 0, 0],
  ],
];

describe("encode/decode connectUsers", () => {
  test.each(cases)("%p", (name, message, protocolSubversion, expectedResult) => {
    const writer = new BufferWriter(64);
    encodeConnectUsers(message, writer, protocolSubversion);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(ConnectUsersMessageType);
    const decoded = decodeConnectUsers(reader, protocolSubversion);
    expect(decoded).toEqual(message);
  });
});
