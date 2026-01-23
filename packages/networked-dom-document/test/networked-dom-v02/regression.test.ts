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

describe("regression tests - v0.2", () => {
  test("remapping issue (#198)", async () => {
    /*
   This is a test added to fix an issue discovered with remapping ids on
   reload and is kept as a regression test.
  */
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(
      `<m-plane id="plane"></m-plane>
<m-cube id="my-cube"></m-cube>
<m-cube></m-cube>
<script>
  const myCube = document.getElementById("my-cube");
  const cube = document.createElement("m-cube"); // 7
  myCube.appendChild(cube);
</script>
`,
    );

    const clientOneWs = new MockWebsocketV02();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);
    clientOneWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 1
      connectionTokens: [null],
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
                      attributes: [["id", "plane"]],
                      children: [],
                      nodeId: 5,
                      tag: "M-PLANE",
                      type: "element",
                    },
                    {
                      attributes: [["id", "my-cube"]],
                      children: [
                        {
                          attributes: [],
                          children: [],
                          nodeId: 7,
                          tag: "M-CUBE",
                          type: "element",
                        },
                      ],
                      nodeId: 6,
                      tag: "M-CUBE",
                      type: "element",
                    },
                    {
                      attributes: [],
                      children: [],
                      nodeId: 8,
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
      `<m-plane id="plane"></m-plane>
<m-plane id="plane-2"></m-plane>

<m-cube id="my-cube"></m-cube>
<m-cube></m-cube>

<script>
  const myCube = document.getElementById("my-cube");
  const cube = document.createElement("m-cube"); // 10
  cube.setAttribute("id", "cube-2");
  myCube.appendChild(cube);

  myCube.addEventListener("click", () => {
    cube.remove();

    const plane = document.createElement("m-plane");
    plane.setAttribute("id", "plane-2");
    myCube.appendChild(plane);
    plane.setAttribute("foo","bar");

    const thirdPlane = document.createElement("m-plane");
    thirdPlane.setAttribute("id", "plane-3");
    myCube.appendChild(thirdPlane);
  });
</script>
`,
    );

    expect(await clientOneWs.waitForTotalMessageCount(7, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        nodeId: 4, // body
        removedNodes: [6], // m-cube (my-cube)
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [["id", "plane-2"]],
            children: [],
            nodeId: 6, // m-plane
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 4, // body
        previousNodeId: 5, // m-plane
        type: "childrenAdded",
      },
      {
        attributes: [["id", "my-cube"]],
        nodeId: 8, // m-cube
        type: "attributesChanged",
      },
      {
        addedNodes: [
          {
            children: [],
            nodeId: 10, // m-cube
            attributes: [["id", "cube-2"]],
            tag: "M-CUBE",
            type: "element",
          },
        ],
        nodeId: 8, // m-cube
        previousNodeId: null,
        type: "childrenAdded",
      },
      {
        addedNodes: [
          {
            attributes: [],
            children: [],
            nodeId: 9, // m-cube
            tag: "M-CUBE",
            type: "element",
          },
        ],
        nodeId: 4, // body
        previousNodeId: 8, // m-cube id="my-cube"
        type: "childrenAdded",
      },
    ]);

    const clickEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 8,
      connectionId: 1,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(12, 7)).toEqual([
      {
        type: "batchStart",
      },
      {
        nodeId: 8,
        removedNodes: [10],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [
              ["id", "plane-2"],
              ["foo", "bar"],
            ],
            children: [],
            nodeId: 11,
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 8,
        previousNodeId: null,
        type: "childrenAdded",
      },
      {
        addedNodes: [
          {
            attributes: [["id", "plane-3"]],
            children: [],
            nodeId: 12,
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 8,
        previousNodeId: 11,
        type: "childrenAdded",
      },
      {
        type: "batchEnd",
      },
    ]);
  });

  test("visible-to toggle does not duplicate children", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<div>
<button id="open-btn">OPEN</button>
</div>
<script>
setTimeout(() => {
const menuOverlay = document.createElement("m-overlay");
menuOverlay.setAttribute("anchor", "center");
menuOverlay.setAttribute("visible-to", "-1");

const row = document.createElement("div");
menuOverlay.appendChild(row);
document.body.appendChild(menuOverlay);

const openBtn = document.getElementById("open-btn");
openBtn.addEventListener("click", () => {
  row.replaceChildren();
  ["A", "B", "C", "D", "E", "F"].forEach((c) => {
    const btn = document.createElement("button");
    btn.textContent = c;
    btn.addEventListener("click", () => menuOverlay.setAttribute("visible-to", "-1"));
    row.appendChild(btn);
  });
  menuOverlay.removeAttribute("visible-to");
});
}, 1);
</script>
`);

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    // Wait for initial snapshot (just the parsed HTML, script runs after setTimeout)
    await clientWs.waitForTotalMessageCount(1);

    // Connect a user
    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1],
      connectionTokens: [null],
    });

    // Allow the script's setTimeout to attach the click handler
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Click the OPEN button (nodeId: 6)
    clientWs.sendToServer({
      type: "event",
      name: "click",
      connectionId: 1,
      nodeId: 6,
      params: {},
      bubbles: true,
    });
    // Expect the overlay to become visible with ABCDEF buttons in the row (nodeId: 8)
    expect(await clientWs.waitForTotalMessageCount(2, 1)).toEqual([
      {
        type: "childrenAdded",
        nodeId: 4,
        previousNodeId: 5,
        addedNodes: [
          {
            type: "element",
            nodeId: 7,
            tag: "M-OVERLAY",
            attributes: [["anchor", "center"]],
            children: [
              {
                type: "element",
                nodeId: 8,
                tag: "DIV",
                attributes: [],
                children: [
                  { type: "element", nodeId: 9, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 10, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 11, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 12, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 13, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 14, tag: "BUTTON", attributes: [], children: [] },
                ],
              },
            ],
          },
        ],
      },
    ]);

    // Click button A (nodeId: 9) - this sets visible-to back to "-1"
    clientWs.sendToServer({
      type: "event",
      name: "click",
      connectionId: 1,
      nodeId: 9,
      params: {},
      bubbles: true,
    });

    // Expect the overlay to be removed from view
    expect(await clientWs.waitForTotalMessageCount(3, 2)).toEqual([
      {
        type: "childrenRemoved",
        nodeId: 4,
        removedNodes: [7],
      },
    ]);

    // Click OPEN again (nodeId: 6)
    clientWs.sendToServer({
      type: "event",
      name: "click",
      connectionId: 1,
      nodeId: 6,
      params: {},
      bubbles: true,
    });

    // Expect the overlay to be re-added with new ABCDEF buttons
    expect(await clientWs.waitForTotalMessageCount(4, 3)).toEqual([
      {
        type: "childrenAdded",
        nodeId: 4,
        previousNodeId: 5,
        addedNodes: [
          {
            type: "element",
            nodeId: 7,
            tag: "M-OVERLAY",
            attributes: [["anchor", "center"]],
            children: [
              {
                type: "element",
                nodeId: 8,
                tag: "DIV",
                attributes: [],
                children: [
                  { type: "element", nodeId: 15, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 16, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 17, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 18, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 19, tag: "BUTTON", attributes: [], children: [] },
                  { type: "element", nodeId: 20, tag: "BUTTON", attributes: [], children: [] },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });
});
