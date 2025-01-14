import { NetworkedDOMV01RemoteEvent } from "@mml-io/networked-dom-protocol";
import { LocalObservableDOMFactory } from "@mml-io/networked-dom-server";

import { EditableNetworkedDOM } from "../../src";
import { MockWebsocketV01 } from "./mock.websocket-v01";

let currentDoc: EditableNetworkedDOM | null = null;
afterEach(() => {
  if (currentDoc) {
    currentDoc.dispose();
    currentDoc = null;
  }
});

describe("multi-client subjectivity - v0.1", () => {
  test("multi-client subjectivity on load - visible-to", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1' onclick='this.setAttribute("visible-to", 2);'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocketV01();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocketV01();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
                      children: [
                        {
                          attributes: {
                            color: "red",
                          },
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
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
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

    const invalidClickEvent: NetworkedDOMV01RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientTwoWs.sendToServer(invalidClickEvent);

    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        message: "Node 6 not found or not visible",
        type: "warning",
      },
    ]);

    const clickEvent: NetworkedDOMV01RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        addedNodes: [],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [6],
        type: "childrenChanged",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(3, 2)).toEqual([
      {
        addedNodes: [
          {
            attributes: {
              color: "red",
            },
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
    ]);
  });

  test("multi-client subjectivity on load - hidden-from", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' hidden-from='2' onclick='this.setAttribute("hidden-from", 1);'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocketV01();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocketV01();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
                      children: [
                        {
                          attributes: {
                            color: "red",
                          },
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
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
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

    const invalidClickEvent: NetworkedDOMV01RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientTwoWs.sendToServer(invalidClickEvent);

    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        message: "Node 6 not found or not visible",
        type: "warning",
      },
    ]);

    const clickEvent: NetworkedDOMV01RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        addedNodes: [],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [6],
        type: "childrenChanged",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(3, 2)).toEqual([
      {
        addedNodes: [
          {
            attributes: {
              color: "red",
            },
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
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

    const clientOneWs = new MockWebsocketV01();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocketV01();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
                      children: [
                        {
                          attributes: {
                            color: "red",
                          },
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
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
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
        addedNodes: [],
        documentTime: expect.any(Number),
        nodeId: 1,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        addedNodes: [],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [6],
        type: "childrenChanged",
      },
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(3, 1)).toEqual([
      {
        addedNodes: [],
        documentTime: expect.any(Number),
        nodeId: 1,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        addedNodes: [
          {
            attributes: {
              color: "red",
            },
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
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

    const clientOneWs = new MockWebsocketV01();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocketV01();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    const clientThreeWs = new MockWebsocketV01();
    doc.addWebSocket(clientThreeWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      {
        documentTime: expect.any(Number),
        snapshot: {
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
                      children: [
                        {
                          attributes: {
                            color: "red",
                          },
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
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
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
          attributes: {},
          children: [
            {
              attributes: {},
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 3,
                  tag: "HEAD",
                  type: "element",
                },
                {
                  attributes: {},
                  children: [
                    {
                      attributes: {},
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
        addedNodes: [],
        documentTime: expect.any(Number),
        nodeId: 1,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        addedNodes: [
          {
            attributes: {
              color: "blue",
            },
            children: [],
            nodeId: 6,
            tag: "M-SPHERE",
            type: "element",
          },
        ],
        nodeId: 5,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
    ]);

    expect(await clientThreeWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        addedNodes: [],
        documentTime: expect.any(Number),
        nodeId: 1,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
    ]);
  });
});
