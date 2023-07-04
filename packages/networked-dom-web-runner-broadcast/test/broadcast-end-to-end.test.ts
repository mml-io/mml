/**
 * @jest-environment jsdom
 */

import {
  FakeWebsocket,
  IframeObservableDOMFactory,
  NetworkedDOMWebRunnerClient,
} from "@mml-io/networked-dom-web-runner";
import { LogMessage } from "@mml-io/observable-dom-common";

import { waitFor } from "./test-util";
import {
  FromBroadcastInstanceMessage,
  NetworkedDOMBroadcastReceiver,
  NetworkedDOMBroadcastRunner,
  ToBroadcastInstanceMessage,
} from "../src";

test("broadcast end-to-end", async () => {
  const logs: LogMessage[] = [];

  const fakeWebSocket = new FakeWebsocket("");

  const broadcastReceiver = new NetworkedDOMBroadcastReceiver(
    (toBroadcastInstanceMessage: ToBroadcastInstanceMessage) => {
      fakeWebSocket.serverSideWebsocket.send(JSON.stringify(toBroadcastInstanceMessage));
    },
    true,
    (logMessage) => {
      logs.push(logMessage);
    },
  );

  fakeWebSocket.serverSideWebsocket.addEventListener("message", (message: MessageEvent) => {
    broadcastReceiver.handleMessage(JSON.parse(message.data) as FromBroadcastInstanceMessage);
  });

  const broadcastRunner = new NetworkedDOMBroadcastRunner(
    (fromBroadcastInstanceMessage: FromBroadcastInstanceMessage) => {
      fakeWebSocket.clientSideWebsocket.send(JSON.stringify(fromBroadcastInstanceMessage));
    },
    IframeObservableDOMFactory,
  );

  fakeWebSocket.clientSideWebsocket.addEventListener("message", (message: MessageEvent) => {
    broadcastRunner.handleMessage(JSON.parse(message.data) as ToBroadcastInstanceMessage);
  });

  const clientsHolder = document.createElement("div");
  document.body.append(clientsHolder);

  const client = new NetworkedDOMWebRunnerClient();
  clientsHolder.append(client.element);
  client.connect(broadcastReceiver.editableNetworkedDOM);

  broadcastRunner.load({
    htmlContents: `<div 
      data-some-id="test-element" 
      onclick="
        this.setAttribute('data-some-attr','new-value'); 
        console.log('broadcast-end-to-end-test-level-log'); 
        console.info('broadcast-end-to-end-test-level-info'); 
        console.warn('broadcast-end-to-end-test-level-warn'); 
        console.error('broadcast-end-to-end-test-level-error'); 
        undef[1];
      "
    ></div>`,
    htmlPath: "file://test.html",
    ignoreTextNodes: false,
    params: {},
  });

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='test-element']").length > 0;
  });
  const testElement = client.element.querySelectorAll("[data-some-id='test-element']")[0];

  testElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await waitFor(() => testElement.getAttribute("data-some-attr") === "new-value");

  expect(logs).toEqual([
    expect.objectContaining({
      level: "log",
      content: ["broadcast-end-to-end-test-level-log"],
    }),
    expect.objectContaining({
      level: "info",
      content: ["broadcast-end-to-end-test-level-info"],
    }),
    expect.objectContaining({
      level: "warn",
      content: ["broadcast-end-to-end-test-level-warn"],
    }),
    expect.objectContaining({
      level: "error",
      content: ["broadcast-end-to-end-test-level-error"],
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

  broadcastRunner.load({
    htmlContents: `<div data-some-id="different-element"></div>`,
    htmlPath: "file://test.html",
    ignoreTextNodes: false,
    params: {},
  });

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='different-element']").length > 0;
  });
});
