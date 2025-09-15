import {
  isNetworkedDOMProtocolSubProtocol_v0_2,
  networkedDOMProtocolSubProtocol_v0_1,
  networkedDOMProtocolSubProtocol_v0_2,
  networkedDOMProtocolSubProtocol_v0_2_1,
  networkedDOMProtocolSubProtocol_v0_2_SubVersionsList,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";

import { NetworkedDOMV01Connection } from "./NetworkedDOMV01Connection";
import { NetworkedDOMV02Connection } from "./NetworkedDOMV02Connection";

// First to last in order of preference
export const SupportedWebsocketSubProtocolsPreferenceOrder = [
  ...networkedDOMProtocolSubProtocol_v0_2_SubVersionsList,
  networkedDOMProtocolSubProtocol_v0_1,
] as const;

export const defaultWebsocketSubProtocol = networkedDOMProtocolSubProtocol_v0_1;

function IsRecognizedWebsocketSubProtocol(
  protocol: string,
): protocol is (typeof SupportedWebsocketSubProtocolsPreferenceOrder)[number] {
  return SupportedWebsocketSubProtocolsPreferenceOrder.includes(protocol as any);
}

export function createNetworkedDOMConnectionForWebsocket(
  webSocket: WebSocket,
): NetworkedDOMV01Connection | NetworkedDOMV02Connection | null {
  let assumedProtocol:
    | typeof networkedDOMProtocolSubProtocol_v0_1
    | typeof networkedDOMProtocolSubProtocol_v0_2
    | typeof networkedDOMProtocolSubProtocol_v0_2_1
    | null = null;
  if (webSocket.protocol) {
    if (!IsRecognizedWebsocketSubProtocol(webSocket.protocol)) {
      const errorMessageString = `Unsupported websocket subprotocol: ${webSocket.protocol}`;
      const errorMessage: Array<NetworkedDOMV02ServerMessage> = [
        {
          type: "error",
          message: errorMessageString,
        },
      ];
      webSocket.send(JSON.stringify(errorMessage));
      webSocket.close();
      return null;
    } else {
      assumedProtocol = webSocket.protocol;
    }
  } else {
    // Assume for now that this client is a legacy MML client that doesn't send a protocol, but send a warning to the client to encourage specifying a protocol
    const warningMessageString = `No websocket subprotocol specified. Please specify a subprotocol to ensure compatibility with networked-dom servers. Assuming subprotocol "${defaultWebsocketSubProtocol}" for this connection.`;
    const warningMessage: Array<NetworkedDOMV02ServerMessage> = [
      {
        type: "warning",
        message: warningMessageString,
      },
    ];
    webSocket.send(JSON.stringify(warningMessage));
    assumedProtocol = defaultWebsocketSubProtocol;
  }

  const isV02 = isNetworkedDOMProtocolSubProtocol_v0_2(assumedProtocol);
  if (isV02) {
    return new NetworkedDOMV02Connection(webSocket);
  }
  return new NetworkedDOMV01Connection(webSocket);
}
