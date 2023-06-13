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

describe("filtering", () => {
  test("filters onclick on reloads", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDomFactory);
    currentDoc = doc;
    doc.load(`
<m-cube onclick="alert('in-first')" color="red"></m-cube>
`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
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
                        attributes: {
                          color: "red",
                        },
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

    doc.load(`
<m-cube onclick="alert('in-second')" color="red"></m-cube>
`);

    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
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

  test("filters onclick on mutation", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDomFactory);
    currentDoc = doc;
    doc.load(`
<m-cube onclick="this.setAttribute('onclick','doSomething()');" color="red"></m-cube>
<m-cube onclick="this.setAttribute('width','5');" color="blue"></m-cube>
`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
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
                        attributes: {
                          color: "red",
                        },
                        children: [],
                        nodeId: 5,
                        tag: "M-CUBE",
                        type: "element",
                      },
                      {
                        attributes: {
                          color: "blue",
                        },
                        children: [],
                        nodeId: 6,
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

    const clickRedEvent: RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 5,
      params: {},
      bubbles: true,
    };
    clientWs.sendToServer(clickRedEvent);

    const clickBlueEvent: RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientWs.sendToServer(clickBlueEvent);

    // There should not be a message in between the first message and the blue m-cube's width attribute update as it should be filtered
    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          attribute: "width",
          newValue: "5",
          nodeId: 6,
          type: "attributeChange",
        },
      ],
    ]);
  });
});
