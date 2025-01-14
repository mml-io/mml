import { NetworkedDOMV02RemoteEvent } from "@mml-io/networked-dom-protocol";
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

describe("filtering - v0.2", () => {
  test("filters onclick on reloads", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube onclick="alert('in-first')" color="red"></m-cube>
`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
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
                      attributes: [["color", "red"]],
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

    doc.load(`
<m-cube onclick="alert('in-second')" color="red"></m-cube>
`);

    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        type: "documentTime",
        documentTime: expect.any(Number),
      },
    ]);
  });

  test("filters onclick on mutation", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube onclick="this.setAttribute('onclick','doSomething()');" color="red"></m-cube>
<m-cube onclick="this.setAttribute('width','5');" color="blue"></m-cube>
`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
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
                      attributes: [["color", "red"]],
                      children: [],
                      nodeId: 5,
                      tag: "M-CUBE",
                      type: "element",
                    },
                    {
                      attributes: [["color", "blue"]],
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
    ]);

    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1],
    });

    const clickRedEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      connectionId: 1,
      nodeId: 5,
      params: {},
      bubbles: true,
    };
    clientWs.sendToServer(clickRedEvent);

    const clickBlueEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      connectionId: 1,
      nodeId: 6,
      params: {},
      bubbles: true,
    };
    clientWs.sendToServer(clickBlueEvent);

    // There should not be a message in between the first message and the blue m-cube's width attribute update as it should be filtered
    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        type: "attributesChanged",
        nodeId: 6,
        attributes: [["width", "5"]],
      },
    ]);
  });
});
