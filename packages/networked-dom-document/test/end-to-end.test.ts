import { LocalObservableDOMFactory } from "networked-dom-server";

import { MockWebsocket } from "./mock.websocket";
import { EditableNetworkedDOM } from "../src";

let currentDoc: EditableNetworkedDOM | null = null;
afterEach(() => {
  if (currentDoc) {
    currentDoc.dispose();
    currentDoc = null;
  }
});

describe("end-to-end", () => {
  test("client-snapshot-and-diff-on-reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load("<m-cube></m-cube>");

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
      [
        {
          type: "snapshot",
          documentTime: expect.any(Number),
          snapshot: {
            type: "element",
            nodeId: 1,
            tag: "DIV",
            attributes: {},
            children: [
              {
                type: "element",
                nodeId: 2,
                tag: "HTML",
                attributes: {},
                children: [
                  { type: "element", nodeId: 3, tag: "HEAD", attributes: {}, children: [] },
                  {
                    type: "element",
                    nodeId: 4,
                    tag: "BODY",
                    attributes: {},
                    children: [
                      { type: "element", nodeId: 5, tag: "M-CUBE", attributes: {}, children: [] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    ]);

    doc.load('<m-cube color="red"></m-cube>');

    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          type: "attributeChange",
          documentTime: expect.any(Number),
          nodeId: 5,
          newValue: "red",
          attribute: "color",
        },
      ],
    ]);
  });

  test("client-snapshot-and-larger-diff-on-reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load("<m-cube></m-cube>");

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
      [
        {
          type: "snapshot",
          documentTime: expect.any(Number),
          snapshot: {
            type: "element",
            nodeId: 1,
            tag: "DIV",
            attributes: {},
            children: [
              {
                type: "element",
                nodeId: 2,
                tag: "HTML",
                attributes: {},
                children: [
                  { type: "element", nodeId: 3, tag: "HEAD", attributes: {}, children: [] },
                  {
                    type: "element",
                    nodeId: 4,
                    tag: "BODY",
                    attributes: {},
                    children: [
                      { type: "element", nodeId: 5, tag: "M-CUBE", attributes: {}, children: [] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    ]);

    doc.load('<m-light type="spotlight"><m-cube></m-cube></m-light>');

    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      [
        {
          addedNodes: [],
          documentTime: expect.any(Number),
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [5],
          type: "childrenChanged",
        },
        {
          addedNodes: [
            {
              attributes: {
                type: "spotlight",
              },
              children: [
                {
                  attributes: {},
                  children: [],
                  nodeId: 6,
                  tag: "M-CUBE",
                  type: "element",
                },
              ],
              nodeId: 5,
              tag: "M-LIGHT",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);
  });

  test("client-sends-event-and-observes-state-change", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube id="clickable-cube" color="red"></m-cube>
<script>
  const clickableCube = document.getElementById("clickable-cube");
  clickableCube.addEventListener("click", () => { 
    clickableCube.setAttribute("color", "green");
  });
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(1)).toEqual([
      [
        {
          type: "snapshot",
          documentTime: expect.any(Number),
          snapshot: {
            type: "element",
            nodeId: 1,
            tag: "DIV",
            attributes: {},
            children: [
              {
                type: "element",
                nodeId: 2,
                tag: "HTML",
                attributes: {},
                children: [
                  { type: "element", nodeId: 3, tag: "HEAD", attributes: {}, children: [] },
                  {
                    type: "element",
                    nodeId: 4,
                    tag: "BODY",
                    attributes: {},
                    children: [
                      {
                        type: "element",
                        nodeId: 5,
                        tag: "M-CUBE",
                        attributes: { color: "red", id: "clickable-cube" },
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    ]);

    clientWs.sendToServer({
      type: "event",
      nodeId: 5,
      name: "click",
      bubbles: true,
      params: {},
    });

    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      [{ type: "attributeChange", nodeId: 5, newValue: "green", attribute: "color" }],
    ]);
  });
});
