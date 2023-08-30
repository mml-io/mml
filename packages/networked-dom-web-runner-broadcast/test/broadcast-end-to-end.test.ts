import { jest } from "@jest/globals";
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

describe("broadcast", function () {
  test("end-to-end", async () => {
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
        id="test-element" 
        onclick="
          this.setAttribute('attr','new-value'); 
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
      return client.element.querySelectorAll("#test-element").length > 0;
    });
    const testElement = client.element.querySelectorAll("#test-element")[0];

    testElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitFor(() => testElement.getAttribute("attr") === "new-value");

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
      htmlContents: `<div id="different-element"></div>`,
      htmlPath: "file://test.html",
      ignoreTextNodes: false,
      params: {},
    });

    await waitFor(() => {
      return client.element.querySelectorAll("#different-element").length > 0;
    });

    broadcastReceiver.clearState();

    await waitFor(() => {
      return client.element.querySelectorAll("#different-element").length === 0;
    });
  });

  test("replace runner", async () => {
    const broadcastReceiver = new NetworkedDOMBroadcastReceiver(
      (toBroadcastInstanceMessage: ToBroadcastInstanceMessage) => {
        currentRunner.handleMessage(toBroadcastInstanceMessage);
      },
      true,
      (logMessage) => {
        console.log("logMessage", logMessage);
      },
    );

    const broadcastRunnerOne = new NetworkedDOMBroadcastRunner(
      (fromBroadcastInstanceMessage: FromBroadcastInstanceMessage) => {
        if (currentRunner !== broadcastRunnerOne) {
          throw new Error("currentRunner !== broadcastRunnerOne");
        }
        broadcastReceiver.handleMessage(fromBroadcastInstanceMessage);
      },
      IframeObservableDOMFactory,
    );
    const broadcastRunnerOneHandlerSpy = jest.spyOn(broadcastRunnerOne, "handleMessage");

    const broadcastRunnerTwo = new NetworkedDOMBroadcastRunner(
      (fromBroadcastInstanceMessage: FromBroadcastInstanceMessage) => {
        if (currentRunner !== broadcastRunnerTwo) {
          throw new Error("currentRunner !== broadcastRunnerTwo");
        }
        broadcastReceiver.handleMessage(fromBroadcastInstanceMessage);
      },
      IframeObservableDOMFactory,
    );
    const broadcastRunnerTwoHandlerSpy = jest.spyOn(broadcastRunnerTwo, "handleMessage");

    let currentRunner = broadcastRunnerOne;

    const clientsHolder = document.createElement("div");
    document.body.append(clientsHolder);

    const client = new NetworkedDOMWebRunnerClient();
    clientsHolder.append(client.element);
    client.connect(broadcastReceiver.editableNetworkedDOM);

    broadcastRunnerOne.load({
      htmlContents: `<div id="test-element-one"></div><div id="inner-element-one"></div></div>`,
      htmlPath: "file://test.html",
      ignoreTextNodes: false,
      params: {},
    });

    await waitFor(() => {
      return client.element.querySelectorAll("#inner-element-one").length > 0;
    });

    expect(broadcastRunnerOneHandlerSpy).toHaveBeenCalledWith({
      message: { connectionId: 1, type: "addConnectedUserId" },
      revisionId: 1,
      type: "instance",
    });

    broadcastRunnerOne.dispose();

    broadcastReceiver.clearRevisionState();

    currentRunner = broadcastRunnerTwo;

    broadcastRunnerTwo.load({
      htmlContents: `<div id="test-element-two"><div id="inner-element-two"></div></div>`,
      htmlPath: "file://test.html",
      ignoreTextNodes: false,
      params: {},
    });

    await waitFor(() => {
      return client.element.querySelectorAll("#inner-element-two").length > 0;
    });

    expect(broadcastRunnerOneHandlerSpy).toHaveBeenCalledWith({
      message: { connectionId: 1, type: "addConnectedUserId" },
      revisionId: 1,
      type: "instance",
    });

    expect(broadcastRunnerTwoHandlerSpy).toHaveBeenNthCalledWith(1, {
      message: { connectionId: 1, type: "addConnectedUserId" },
      revisionId: 1,
      type: "instance",
    });
  });
});
