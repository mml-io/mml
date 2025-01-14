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
            nodeId: 10,
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
            nodeId: 11,
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 8,
        previousNodeId: 10,
        type: "childrenAdded",
      },
      {
        type: "batchEnd",
      },
    ]);
  });
});
