/**
 * @jest-environment jsdom
 */

import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import {
  FakeWebsocket,
  IframeObservableDOMFactory,
  NetworkedDOMWebRunnerClient,
} from "@mml-io/networked-dom-web-runner";
import {
  applyMessageToObservableDOMInstance,
  LogMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import { waitFor } from "./test-util";
import {
  FromRemoteInstanceMessage,
  RemoteNetworkedDOMInstanceClient,
  RemoteNetworkedDOMInstanceServer,
  ToRemoteServerMessage,
} from "../src";

test("relay end-to-end", async () => {
  const logs: LogMessage[] = [];

  const fakeWebSocket = new FakeWebsocket("");

  const remoteClient = new RemoteNetworkedDOMInstanceClient(
    (toRemoteServerMessage: ToRemoteServerMessage) => {
      fakeWebSocket.clientSideWebsocket.send(JSON.stringify(toRemoteServerMessage));
    },
  );

  fakeWebSocket.clientSideWebsocket.addEventListener("message", (message: MessageEvent) => {
    remoteClient.handleMessage(JSON.parse(message.data) as FromRemoteInstanceMessage);
  });

  const remoteServer = new RemoteNetworkedDOMInstanceServer(
    (message: FromRemoteInstanceMessage) => {
      fakeWebSocket.serverSideWebsocket.send(JSON.stringify(message));
    },
    (params: ObservableDOMParameters, callback) => {
      const instance = IframeObservableDOMFactory(params, (message) => {
        callback({
          type: "dom",
          message,
        });
      });
      return {
        handleMessage: (message: ToObservableDOMInstanceMessage) => {
          applyMessageToObservableDOMInstance(message, instance);
        },
        dispose: () => {
          instance.dispose();
        },
      };
    },
  );

  fakeWebSocket.serverSideWebsocket.addEventListener("message", (message: MessageEvent) => {
    remoteServer.handleMessage(JSON.parse(message.data) as ToRemoteServerMessage);
  });

  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    (observableDOMParameters, callback) => {
      return remoteClient.create(observableDOMParameters, callback);
    },
    false,
    (logMessage) => {
      logs.push(logMessage);
    },
  );

  const clientsHolder = document.createElement("div");
  document.body.append(clientsHolder);

  const client = new NetworkedDOMWebRunnerClient();
  clientsHolder.append(client.element);
  client.connect(networkedDOMDocument);

  networkedDOMDocument.load(
    `<div 
      data-some-id="test-element" 
      onclick="
        this.setAttribute('data-some-attr','new-value'); 
        console.log('relay-end-to-end-test-level-log'); 
        console.info('relay-end-to-end-test-level-info'); 
        console.warn('relay-end-to-end-test-level-warn'); 
        console.error('relay-end-to-end-test-level-error'); 
        undef[1];
      "
    ></div>`,
  );

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='test-element']").length > 0;
  });
  const testElement = client.element.querySelectorAll("[data-some-id='test-element']")[0];

  testElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await waitFor(() => testElement.getAttribute("data-some-attr") === "new-value");

  expect(logs).toEqual([
    expect.objectContaining({
      level: "log",
      content: ["relay-end-to-end-test-level-log"],
    }),
    expect.objectContaining({
      level: "info",
      content: ["relay-end-to-end-test-level-info"],
    }),
    expect.objectContaining({
      level: "warn",
      content: ["relay-end-to-end-test-level-warn"],
    }),
    expect.objectContaining({
      level: "error",
      content: ["relay-end-to-end-test-level-error"],
    }),
    expect.objectContaining({
      level: "system",
      content: [
        expect.objectContaining({
          message: "undef is not defined",
          type: "ReferenceError",
        }),
      ],
    }),
  ]);

  networkedDOMDocument.load(`<div data-some-id="different-element"></div>`);

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='different-element']").length > 0;
  });

  networkedDOMDocument.dispose();
});
