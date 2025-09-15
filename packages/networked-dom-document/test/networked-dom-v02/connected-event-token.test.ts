import { LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import { LogMessage } from "@mml-io/observable-dom-common";

import { EditableNetworkedDOM } from "../../src";
import { waitUntil } from "../waitUntil";
import { MockWebsocketV02 } from "./mock.websocket-v02";

let currentDoc: EditableNetworkedDOM | null = null;

afterEach(() => {
  if (currentDoc) {
    currentDoc.dispose();
    currentDoc = null;
  }
});

describe("connected event token field - v0.2", () => {
  test("client connects with token - MML code receives connected event with token", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file://test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;

    doc.load(`
<script>
  window.addEventListener("connected", (event) => {
    console.log("CONNECTED_EVENT:" + JSON.stringify({
      connectionId: event.detail.connectionId,
      connectionToken: event.detail.connectionToken
    }));
  });
</script>`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    // Wait for initial snapshot
    await clientWs.waitForTotalMessageCount(1);

    // Connect with a token
    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [42],
      connectionTokens: ["user-token-123"],
    });

    // Wait for the connected event to be logged
    await waitUntil(() =>
      loggedMessages.some(
        (msg) =>
          msg.content.length > 0 &&
          typeof msg.content[0] === "string" &&
          msg.content[0].includes("CONNECTED_EVENT:"),
      ),
    );

    const connectedEventLog = loggedMessages.find(
      (msg) =>
        msg.content.length > 0 &&
        typeof msg.content[0] === "string" &&
        msg.content[0].includes("CONNECTED_EVENT:"),
    );

    expect(connectedEventLog).toBeDefined();

    const eventDataString = connectedEventLog!.content[0] as string;
    const eventData = JSON.parse(eventDataString.replace("CONNECTED_EVENT:", ""));

    expect(eventData).toEqual({
      connectionId: 1, // Internal connection ID (should be 1 for first connection)
      connectionToken: "user-token-123",
    });
  });

  test("client connects without token - MML code receives connected event with null token", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file://test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;

    doc.load(`
<script>
  window.addEventListener("connected", (event) => {
    console.log("CONNECTED_EVENT:" + JSON.stringify({
      connectionId: event.detail.connectionId,
      connectionToken: event.detail.connectionToken
    }));
  });
</script>`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    // Wait for initial snapshot
    await clientWs.waitForTotalMessageCount(1);

    // Connect without a token (null)
    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [42],
      connectionTokens: [null],
    });

    // Wait for the connected event to be logged
    await waitUntil(() =>
      loggedMessages.some(
        (msg) =>
          msg.content.length > 0 &&
          typeof msg.content[0] === "string" &&
          msg.content[0].includes("CONNECTED_EVENT:"),
      ),
    );

    const connectedEventLog = loggedMessages.find(
      (msg) =>
        msg.content.length > 0 &&
        typeof msg.content[0] === "string" &&
        msg.content[0].includes("CONNECTED_EVENT:"),
    );

    expect(connectedEventLog).toBeDefined();

    const eventDataString = connectedEventLog!.content[0] as string;
    const eventData = JSON.parse(eventDataString.replace("CONNECTED_EVENT:", ""));

    expect(eventData).toEqual({
      connectionId: 1, // Internal connection ID
      connectionToken: null,
    });
  });

  test("multiple clients with different tokens - MML code receives separate connected events", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file://test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;

    doc.load(`
<script>
  window.addEventListener("connected", (event) => {
    console.log("CONNECTED_EVENT:" + JSON.stringify({
      connectionId: event.detail.connectionId,
      connectionToken: event.detail.connectionToken
    }));
  });
</script>`);

    // First client
    const clientWs1 = new MockWebsocketV02();
    doc.addWebSocket(clientWs1 as unknown as WebSocket);
    await clientWs1.waitForTotalMessageCount(1);

    clientWs1.sendToServer({
      type: "connectUsers",
      connectionIds: [100],
      connectionTokens: ["token-client-1"],
    });

    // Wait for first connected event
    await waitUntil(
      () =>
        loggedMessages.filter(
          (msg) =>
            msg.content.length > 0 &&
            typeof msg.content[0] === "string" &&
            msg.content[0].includes("CONNECTED_EVENT:"),
        ).length >= 1,
    );

    // Second client
    const clientWs2 = new MockWebsocketV02();
    doc.addWebSocket(clientWs2 as unknown as WebSocket);
    await clientWs2.waitForTotalMessageCount(1);

    clientWs2.sendToServer({
      type: "connectUsers",
      connectionIds: [200],
      connectionTokens: ["token-client-2"],
    });

    // Wait for second connected event
    await waitUntil(
      () =>
        loggedMessages.filter(
          (msg) =>
            msg.content.length > 0 &&
            typeof msg.content[0] === "string" &&
            msg.content[0].includes("CONNECTED_EVENT:"),
        ).length >= 2,
    );

    // Third client with no token
    const clientWs3 = new MockWebsocketV02();
    doc.addWebSocket(clientWs3 as unknown as WebSocket);
    await clientWs3.waitForTotalMessageCount(1);

    clientWs3.sendToServer({
      type: "connectUsers",
      connectionIds: [300],
      connectionTokens: [null],
    });

    // Wait for third connected event
    await waitUntil(
      () =>
        loggedMessages.filter(
          (msg) =>
            msg.content.length > 0 &&
            typeof msg.content[0] === "string" &&
            msg.content[0].includes("CONNECTED_EVENT:"),
        ).length >= 3,
    );

    // Extract all connected event logs
    const connectedEventLogs = loggedMessages.filter(
      (msg) =>
        msg.content.length > 0 &&
        typeof msg.content[0] === "string" &&
        msg.content[0].includes("CONNECTED_EVENT:"),
    );

    expect(connectedEventLogs).toHaveLength(3);

    const connectedEvents = connectedEventLogs.map((log) => {
      const eventDataString = log.content[0] as string;
      return JSON.parse(eventDataString.replace("CONNECTED_EVENT:", ""));
    });

    expect(connectedEvents).toEqual([
      { connectionId: 1, connectionToken: "token-client-1" },
      { connectionId: 2, connectionToken: "token-client-2" },
      { connectionId: 3, connectionToken: null },
    ]);
  });

  test("client connects with multiple users and mixed tokens", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file://test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;

    doc.load(`
<script>
  window.addEventListener("connected", (event) => {
    console.log("CONNECTED_EVENT:" + JSON.stringify({
      connectionId: event.detail.connectionId,
      connectionToken: event.detail.connectionToken
    }));
  });
</script>`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    // Wait for initial snapshot
    await clientWs.waitForTotalMessageCount(1);

    // Connect multiple users with mixed tokens
    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [101, 102, 103],
      connectionTokens: ["user-token-a", null, "user-token-c"],
    });

    // Wait for all connected events to be logged
    await waitUntil(
      () =>
        loggedMessages.filter(
          (msg) =>
            msg.content.length > 0 &&
            typeof msg.content[0] === "string" &&
            msg.content[0].includes("CONNECTED_EVENT:"),
        ).length >= 3,
    );

    const connectedEventLogs = loggedMessages.filter(
      (msg) =>
        msg.content.length > 0 &&
        typeof msg.content[0] === "string" &&
        msg.content[0].includes("CONNECTED_EVENT:"),
    );

    expect(connectedEventLogs).toHaveLength(3);

    const connectedEvents = connectedEventLogs.map((log) => {
      const eventDataString = log.content[0] as string;
      return JSON.parse(eventDataString.replace("CONNECTED_EVENT:", ""));
    });

    expect(connectedEvents).toEqual([
      { connectionId: 1, connectionToken: "user-token-a" },
      { connectionId: 2, connectionToken: null },
      { connectionId: 3, connectionToken: "user-token-c" },
    ]);
  });

  test("empty string token is treated as null", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file://test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;

    doc.load(`
<script>
  window.addEventListener("connected", (event) => {
    console.log("CONNECTED_EVENT:" + JSON.stringify({
      connectionId: event.detail.connectionId,
      connectionToken: event.detail.connectionToken
    }));
  });
</script>`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    // Wait for initial snapshot
    await clientWs.waitForTotalMessageCount(1);

    // Connect with an empty string token (should be treated as null)
    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [42],
      connectionTokens: [""], // Empty string should become null
    });

    // Wait for the connected event to be logged
    await waitUntil(() =>
      loggedMessages.some(
        (msg) =>
          msg.content.length > 0 &&
          typeof msg.content[0] === "string" &&
          msg.content[0].includes("CONNECTED_EVENT:"),
      ),
    );

    const connectedEventLog = loggedMessages.find(
      (msg) =>
        msg.content.length > 0 &&
        typeof msg.content[0] === "string" &&
        msg.content[0].includes("CONNECTED_EVENT:"),
    );

    expect(connectedEventLog).toBeDefined();

    const eventDataString = connectedEventLog!.content[0] as string;
    const eventData = JSON.parse(eventDataString.replace("CONNECTED_EVENT:", ""));

    expect(eventData).toEqual({
      connectionId: 1,
      connectionToken: null, // Empty string should be converted to null
    });
  });
});
