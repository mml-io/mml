import { RemoteEvent } from "@mml-io/networked-dom-protocol";
import { LocalObservableDomFactory } from "networked-dom-server";

import { MockWebsocket } from "./mock.websocket";
import { EditableNetworkedDOM } from "../src";

let currentDoc: EditableNetworkedDOM | null = null;
afterEach(() => {
  if (currentDoc) {
    currentDoc.dispose();
    currentDoc = null;
  }
});

describe("multi-client subjectivity", () => {
  test("multi-client subjectivity on load", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDomFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1' onclick='this.setAttribute("visible-to", 2);'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocket();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocket();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      [
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
                              "visible-to": "1",
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
      ],
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      [
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
      ],
    ]);

    const clickEvent: RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [],
          nodeId: 5,
          previousNodeId: null,
          removedNodes: [6],
          type: "childrenChanged",
        },
      ],
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "red",
                "visible-to": "2",
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
      ],
    ]);
  });

  test("multi-client subjectivity with reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDomFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocket();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocket();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      [
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
                              "visible-to": "1",
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
      ],
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      [
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
      ],
    ]);

    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='2'></m-sphere>
    </m-cube>`,
    );

    expect(await clientOneWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [],
          documentTime: expect.any(Number),
          nodeId: 5,
          previousNodeId: null,
          removedNodes: [6],
          type: "childrenChanged",
        },
      ],
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "red",
                "visible-to": "2",
              },
              children: [],
              nodeId: 6,
              tag: "M-SPHERE",
              type: "element",
            },
          ],
          documentTime: expect.any(Number),
          nodeId: 5,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);
  });

  test("multi-client subjectivity with reload and change connections", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDomFactory);
    currentDoc = doc;
    doc.load(
      `
    <m-cube>
      <m-sphere color='red' visible-to='1'></m-sphere>
    </m-cube>`,
    );

    const clientOneWs = new MockWebsocket();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

    const clientTwoWs = new MockWebsocket();
    doc.addWebSocket(clientTwoWs as unknown as WebSocket);

    const clientThreeWs = new MockWebsocket();
    doc.addWebSocket(clientThreeWs as unknown as WebSocket);

    expect(await clientOneWs.waitForTotalMessageCount(1)).toEqual([
      [
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
                              "visible-to": "1",
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
      ],
    ]);
    expect(await clientTwoWs.waitForTotalMessageCount(1)).toEqual([
      [
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
      ],
    ]);
    expect(await clientThreeWs.waitForTotalMessageCount(1)).toEqual([
      [
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
      ],
    ]);

    expect((doc as any).websockets).toContain(clientOneWs);
    // This causes there to be only one listener - client 2 (that will now be id 1 when the document is updated)
    doc.removeWebSocket(clientOneWs as unknown as WebSocket);

    expect((doc as any).websockets).not.toContain(clientOneWs);

    doc.load(
      `
    <m-cube>
      <m-sphere color='blue' visible-to='2'></m-sphere>
    </m-cube>`,
    );

    expect(await clientTwoWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "blue",
                "visible-to": "2",
              },
              children: [],
              nodeId: 6,
              tag: "M-SPHERE",
              type: "element",
            },
          ],
          documentTime: expect.any(Number),
          nodeId: 5,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);

    expect(await clientThreeWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [],
          documentTime: expect.any(Number),
          nodeId: 1,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);
  });
});
