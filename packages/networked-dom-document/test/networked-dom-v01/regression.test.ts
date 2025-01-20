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

describe("regression tests - v0.1", () => {
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

    const clientOneWs = new MockWebsocketV01();
    doc.addWebSocket(clientOneWs as unknown as WebSocket);

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
                      attributes: {
                        id: "plane",
                      },
                      children: [],
                      nodeId: 5,
                      tag: "M-PLANE",
                      type: "element",
                    },
                    {
                      attributes: {
                        id: "my-cube",
                      },
                      children: [
                        {
                          attributes: {},
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
                      attributes: {},
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
        addedNodes: [],
        documentTime: expect.any(Number),
        nodeId: 1,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        addedNodes: [],
        nodeId: 4, // body
        previousNodeId: null,
        removedNodes: [6], // m-cube (my-cube)
        type: "childrenChanged",
      },
      {
        addedNodes: [
          {
            attributes: {
              id: "plane-2",
            },
            children: [],
            nodeId: 6, // m-plane
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 4, // body
        previousNodeId: 5, // m-plane
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        attribute: "id",
        newValue: "my-cube",
        nodeId: 8, // m-cube
        type: "attributeChange",
      },
      {
        addedNodes: [
          {
            children: [],
            nodeId: 10, // m-cube
            attributes: {
              id: "cube-2",
            },
            tag: "M-CUBE",
            type: "element",
          },
        ],
        nodeId: 8, // m-cube
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        addedNodes: [
          {
            attributes: {},
            children: [],
            nodeId: 9, // m-cube
            tag: "M-CUBE",
            type: "element",
          },
        ],
        nodeId: 4, // body
        previousNodeId: 8, // m-cube id="my-cube"
        removedNodes: [],
        type: "childrenChanged",
      },
    ]);

    const clickEvent: NetworkedDOMV01RemoteEvent = {
      type: "event",
      name: "click",
      nodeId: 8,
      params: {},
      bubbles: true,
    };
    clientOneWs.sendToServer(clickEvent);

    expect(await clientOneWs.waitForTotalMessageCount(10, 7)).toEqual([
      {
        addedNodes: [],
        nodeId: 8,
        previousNodeId: null,
        removedNodes: [10],
        type: "childrenChanged",
      },
      {
        addedNodes: [
          {
            attributes: {
              foo: "bar",
              id: "plane-2",
            },
            children: [],
            nodeId: 10,
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 8,
        previousNodeId: null,
        removedNodes: [],
        type: "childrenChanged",
      },
      {
        addedNodes: [
          {
            attributes: {
              id: "plane-3",
            },
            children: [],
            nodeId: 11,
            tag: "M-PLANE",
            type: "element",
          },
        ],
        nodeId: 8,
        previousNodeId: 10,
        removedNodes: [],
        type: "childrenChanged",
      },
    ]);
  });
});
