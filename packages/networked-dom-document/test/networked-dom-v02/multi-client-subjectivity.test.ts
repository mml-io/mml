import {
  NetworkedDOMV02DisconnectUsersMessage,
  NetworkedDOMV02RemoteEvent,
} from "@mml-io/networked-dom-protocol";
import { LocalObservableDOMFactory } from "@mml-io/networked-dom-server";

import { EditableNetworkedDOM } from "../../src";
import { MockWebsocketV02 } from "./mock.websocket-v02";

let currentDoc: EditableNetworkedDOM | null = null;
afterEach(() => {
  if (currentDoc) {
    currentDoc.dispose();
    currentDoc = null;
  }
});

describe("multi-client subjectivity - v0.2", () => {
  test("multi-client subjectivity on load - visible-to", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;

    const clientOneWs = new MockWebsocketV02();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);
    clientOneWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 1
    });

    const clientTwoWs = new MockWebsocketV02();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);
    clientTwoWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 2
    });

    // Load only after the connections are established
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1' onclick='this.setAttribute("visible-to", 2);'></m-sphere>
    </m-cube>`,
    );

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [
                        {
                          attributes: [["color", "red"]],
                          children: [],
                          nodeId: 6,
                          tag: "M-SPHERE",
                          type: "element",
                          visibleTo: [1],
                        },
                      ],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);

    const invalidClickEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      connectionId: 1,
      params: {},
      bubbles: true,
    };
    clientTwoWs.sendToServer(invalidClickEvent);

    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        message: "Node 6 not found or not visible to connection 1",
        type: "warning",
      },
    ]);

    const clickEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      connectionId: 1,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        nodeId: 5,
        removedNodes: [6],
        type: "childrenRemoved",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(3, 2)).toEqual([
      {
        addedNodes: [
          {
            attributes: [["color", "red"]],
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
            visibleTo: [1],
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        type: "childrenAdded",
      },
    ]);
  });

  test("multi-client subjectivity on load - hidden-from", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;

    const clientOneWs = new MockWebsocketV02();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);
    clientOneWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 1
    });

    const clientTwoWs = new MockWebsocketV02();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);
    clientTwoWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 2
    });

    // Load only after the connections are established
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' hidden-from='2' onclick='this.setAttribute("hidden-from", 1);'></m-sphere>
    </m-cube>`,
    );

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [
                        {
                          attributes: [["color", "red"]],
                          children: [],
                          nodeId: 6,
                          tag: "M-SPHERE",
                          type: "element",
                        },
                      ],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [
                        {
                          attributes: [["color", "red"]],
                          children: [],
                          hiddenFrom: [1],
                          nodeId: 6,
                          tag: "M-SPHERE",
                          type: "element",
                        },
                      ],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);

    const invalidClickEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      connectionId: 1,
      params: {},
      bubbles: true,
    };
    clientTwoWs.sendToServer(invalidClickEvent);

    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        message: "Node 6 not found or not visible to connection 1",
        type: "warning",
      },
    ]);

    const clickEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      connectionId: 1,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        type: "changeHiddenFrom",
        addHiddenFrom: [1],
        nodeId: 6,
        removeHiddenFrom: [],
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(3, 2)).toEqual([
      {
        addHiddenFrom: [],
        nodeId: 6,
        removeHiddenFrom: [1],
        type: "changeHiddenFrom",
      },
    ]);
  });

  test("multi-client subjectivity with reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocketV02();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);
    clientOneWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 1
    });

    const clientTwoWs = new MockWebsocketV02();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);
    clientTwoWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 2
    });

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [
                        {
                          attributes: [["color", "red"]],
                          children: [],
                          nodeId: 6,
                          tag: "M-SPHERE",
                          type: "element",
                          visibleTo: [1],
                        },
                      ],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);

    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='2'></m-sphere>
    </m-cube>`,
    );

    expect(await clientOneWs.waitForTotalMessageCount(3, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        nodeId: 5,
        removedNodes: [6],
        type: "childrenRemoved",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(3, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        addedNodes: [
          {
            attributes: [["color", "red"]],
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
            visibleTo: [1],
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        type: "childrenAdded",
      },
    ]);
  });

  test("multi-client subjectivity with reload and change connections", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocketV02();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);
    clientOneWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 1
    });

    const clientTwoWs = new MockWebsocketV02();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);
    clientTwoWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 2
    });

    const clientThreeWs = new MockWebsocketV02();
    doc.addWebSocket(clientThreeWs as unknown as WebSocket);
    clientThreeWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 3
    });

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [
                        {
                          attributes: [["color", "red"]],
                          children: [],
                          nodeId: 6,
                          tag: "M-SPHERE",
                          type: "element",
                          visibleTo: [1],
                        },
                      ],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);
    expect(await clientThreeWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);

    expect((doc as any).websockets.keys()).toContain(clientOneWs);
    // This causes there to be only one listener - client 2 (that will now be id 1 when the document is updated)
    doc.removeWebSocket(clientOneWs as unknown as WebSocket);

    expect((doc as any).websockets.keys()).not.toContain(clientOneWs);

    doc.load(
      `
    <m-cube>
      <m-sphere color='blue' visible-to='2'></m-sphere>
    </m-cube>`,
    );

    expect(await clientTwoWs.waitForTotalMessageCount(3, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        addedNodes: [
          {
            attributes: [["color", "blue"]],
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
            visibleTo: [1],
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        type: "childrenAdded",
      },
    ]);

    expect(await clientThreeWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
    ]);
  });

  test("visibility changes on disconnect", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;

    const clientOneWs = new MockWebsocketV02();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);
    clientOneWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1, 2], // Should be internal id 1, 2
    });

    // Load only after the connections are established
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1,2'></m-sphere>
      <m-sphere color='green' visible-to='1'></m-sphere>
      <m-sphere color='blue' visible-to='2' onclick='this.setAttribute("visible-to", 1);'></m-sphere>
    </m-cube>`,
    );

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: [],
          children: [
            {
              attributes: [],
              children: [
                {
                  attributes: [],
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: [],
                  children: [
                    {
                      attributes: [],
                      children: [
                        {
                          attributes: [["color", "red"]],
                          children: [],
                          nodeId: 6,
                          tag: "M-SPHERE",
                          type: "element",
                          visibleTo: [1, 2],
                        },
                        {
                          attributes: [["color", "green"]],
                          children: [],
                          nodeId: 7,
                          tag: "M-SPHERE",
                          type: "element",
                          visibleTo: [1],
                        },
                        {
                          attributes: [["color", "blue"]],
                          children: [],
                          nodeId: 8,
                          tag: "M-SPHERE",
                          type: "element",
                          visibleTo: [2],
                        },
                      ],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                  ],
                  nodeId: 4,
                  tag: "BODY",
                  type: "element",
                },
              ],
              nodeId: 2,
              tag: "HTML",
              type: "element",
            },
          ],
          nodeId: 1,
          tag: "DIV",
          type: "element",
        },
        type: "snapshot",
      },
    ]);

    const clickEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 8,
      connectionId: 2,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        addVisibleTo: [1],
        nodeId: 8,
        removeVisibleTo: [2],
        type: "changeVisibleTo",
      },
    ]);

    const disconnectEvent: NetworkedDOMV02DisconnectUsersMessage = {
      type: "disconnectUsers",
      connectionIds: [1],
    };
    clientOneWs.sendToServer(disconnectEvent);

    expect(await clientOneWs.waitForTotalMessageCount(3, 2)).toEqual([
      {
        nodeId: 5,
        removedNodes: [7, 8],
        type: "childrenRemoved",
      },
    ]);
  });
});
