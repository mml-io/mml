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

describe("end to end", () => {
  test("client snapshot and diff on reload", async () => {
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

  test("client snapshot and larger diff on reload", async () => {
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

  test("client sends event and observes state change", async () => {
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

  test("simple nested removal", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    c2.remove();
  }, 1);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(2)).toEqual([
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
                          id: "c1",
                          z: "2",
                        },
                        children: [
                          {
                            attributes: {
                              color: "green",
                              id: "c2",
                              x: "2",
                            },
                            children: [],
                            nodeId: 6,
                            tag: "M-CUBE",
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
  });

  test("simple nested re-addition", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    document.body.appendChild(c2);
  }, 1);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(3)).toEqual([
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
                          id: "c1",
                          z: "2",
                        },
                        children: [
                          {
                            attributes: {
                              color: "green",
                              id: "c2",
                              x: "2",
                            },
                            children: [],
                            nodeId: 6,
                            tag: "M-CUBE",
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
      [
        {
          addedNodes: [],
          nodeId: 5,
          previousNodeId: null,
          removedNodes: [6],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "green",
                id: "c2",
                x: "2",
              },
              children: [],
              nodeId: 7,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: 5,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);
  });

  test("appending child element to ancestor", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    document.body.appendChild(c1);
    // The issue here is that when c1 is appended to the body, c2 is meant to be its child, but because the state being used to determine the children of c1 already has c2 as a child of the body, c1 doesn't have c2 as a child.
    
    // The subsequent mutation is then that c2 is removed from c1, but c2 was never observed to be a child of c1 so the mutation is invalid for an observer.
    document.body.appendChild(c2);
  }, 1000);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(4)).toEqual([
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
                          id: "c1",
                          z: "2",
                        },
                        children: [
                          {
                            attributes: {
                              color: "green",
                              id: "c2",
                              x: "2",
                            },
                            children: [],
                            nodeId: 6,
                            tag: "M-CUBE",
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
      [
        {
          addedNodes: [],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [5],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "red",
                id: "c1",
                z: "2",
              },
              children: [],
              nodeId: 7,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "green",
                id: "c2",
                x: "2",
              },
              children: [],
              nodeId: 8,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: 7,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);
  });

  test("multiple element additions", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    document.body.appendChild(c1);
    document.body.appendChild(c2);
    c1.appendChild(c2);
  }, 1);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(4)).toEqual([
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
                          id: "c1",
                          z: "2",
                        },
                        children: [
                          {
                            attributes: {
                              color: "green",
                              id: "c2",
                              x: "2",
                            },
                            children: [],
                            nodeId: 6,
                            tag: "M-CUBE",
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
      [
        {
          addedNodes: [],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [5],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "red",
                id: "c1",
                z: "2",
              },
              children: [
                {
                  attributes: {
                    color: "green",
                    id: "c2",
                    x: "2",
                  },
                  children: [],
                  nodeId: 8,
                  tag: "M-CUBE",
                  type: "element",
                },
              ],
              nodeId: 7,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [],
          nodeId: 7,
          previousNodeId: null,
          removedNodes: [8],
          type: "childrenChanged",
        },
      ],
    ]);
  });

  test("multiple element additions after removal", async () => {
    /* TODO - this test is not desirable behaviour, but is here to ensure that
        the handling of this case is done without errors. If a more correct
        implementation fails this test then change the test.
    */
    /* This test checks that the unintended behaviour of MutationObserver usage
       where multiple mutations are batched together does not result in protocol
       errors. The messages that are sent to the client do not reflect the
       order of changes that were made to the document, but the resulting state
       should match.
    */
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    c2.remove();
    document.body.appendChild(c1);
    document.body.appendChild(c2);
    c1.appendChild(c2);
  }, 1);
</script>`);
    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(4)).toEqual([
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
                          id: "c1",
                          z: "2",
                        },
                        children: [
                          {
                            attributes: {
                              color: "green",
                              id: "c2",
                              x: "2",
                            },
                            children: [],
                            nodeId: 6,
                            tag: "M-CUBE",
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
      [
        {
          addedNodes: [],
          nodeId: 5,
          previousNodeId: null,
          removedNodes: [6],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [5],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "red",
                id: "c1",
                z: "2",
              },
              children: [
                {
                  attributes: {
                    color: "green",
                    id: "c2",
                    x: "2",
                  },
                  children: [],
                  nodeId: 8,
                  tag: "M-CUBE",
                  type: "element",
                },
              ],
              nodeId: 7,
              tag: "M-CUBE",
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

  test("child addition", async () => {
    /* TODO - this test is not desirable behaviour, but is here to ensure that
        the handling of this case is done without errors. If a more correct
        implementation fails this test then change the test.
    */
    /* This test checks that the unintended behaviour of MutationObserver usage
       where multiple mutations are batched together does not result in protocol
       errors. The messages that are sent to the client do not reflect the
       order of changes that were made to the document, but the resulting state
       should match.
    */
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<script>
setTimeout(() => {
  const c1 = document.createElement("m-cube");
  c1.setAttribute("x", "1");
  const c2 = document.createElement("m-cube");
  c2.setAttribute("y", "1");
  document.body.appendChild(c1);
  c1.appendChild(c2);
  c2.setAttribute("y", "2");
}, 1);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(3)).toEqual([
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
                    children: [],
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
      [
        {
          addedNodes: [
            {
              attributes: {
                x: "1",
              },
              children: [
                {
                  attributes: {
                    y: "2", // This value should be "1" and not "2" at the point the node is added
                  },
                  children: [],
                  nodeId: 6,
                  tag: "M-CUBE",
                  type: "element",
                },
              ],
              nodeId: 5,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      [
        {
          attribute: "y",
          newValue: "2",
          nodeId: 6,
          type: "attributeChange",
        },
      ],
    ]);
  });

  test("element insertion ordering", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2"></m-cube>
  <m-cube color="orange" x="4" id="c3"></m-cube>
  <m-cube color="pink" x="6" id="c4"></m-cube>
  <m-cube color="purple" x="8" id="c5"></m-cube>
</m-cube>

<m-cube color="black" z="-2" id="t1">
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  const c3 = document.getElementById("c3");
  const c4 = document.getElementById("c4");
  const c5 = document.getElementById("c5");
  const t1 = document.getElementById("t1");
  setTimeout(() => {
    t1.appendChild(c3);
    t1.appendChild(c5);
    t1.insertBefore(c4, c3);
  }, 1);
</script>
`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(7)).toEqual([
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
                          id: "c1",
                          z: "2",
                        },
                        children: [
                          {
                            attributes: {
                              color: "green",
                              id: "c2",
                              x: "2",
                            },
                            children: [],
                            nodeId: 6,
                            tag: "M-CUBE",
                            type: "element",
                          },
                          {
                            attributes: {
                              color: "orange",
                              id: "c3",
                              x: "4",
                            },
                            children: [],
                            nodeId: 7,
                            tag: "M-CUBE",
                            type: "element",
                          },
                          {
                            attributes: {
                              color: "pink",
                              id: "c4",
                              x: "6",
                            },
                            children: [],
                            nodeId: 8,
                            tag: "M-CUBE",
                            type: "element",
                          },
                          {
                            attributes: {
                              color: "purple",
                              id: "c5",
                              x: "8",
                            },
                            children: [],
                            nodeId: 9,
                            tag: "M-CUBE",
                            type: "element",
                          },
                        ],
                        nodeId: 5,
                        tag: "M-CUBE",
                        type: "element",
                      },
                      {
                        attributes: {
                          color: "black",
                          id: "t1",
                          z: "-2",
                        },
                        children: [],
                        nodeId: 10,
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
      [
        {
          addedNodes: [],
          nodeId: 5,
          previousNodeId: 6,
          removedNodes: [7],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "orange",
                id: "c3",
                x: "4",
              },
              children: [],
              nodeId: 11,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 10,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [],
          nodeId: 5,
          previousNodeId: 6,
          removedNodes: [9],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "purple",
                id: "c5",
                x: "8",
              },
              children: [],
              nodeId: 12,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 10,
          previousNodeId: 11,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [],
          nodeId: 5,
          previousNodeId: 6,
          removedNodes: [8],
          type: "childrenChanged",
        },
      ],
      [
        {
          addedNodes: [
            {
              attributes: {
                color: "pink",
                id: "c4",
                x: "6",
              },
              children: [],
              nodeId: 13,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 10,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
    ]);
  });

  test("multiple element attribute changes observation", async () => {
    /* TODO - this test is not desirable behaviour, but is here to ensure that
        the handling of this case is done without errors. If a more correct
        implementation fails this test then change the test.
    */
    /* This test checks that regardless of the order of attribute changes still
        results in an eventually-consistent client view.
     */
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<script>
setTimeout(() => {
  const c1 = document.createElement("m-cube");
  c1.setAttribute("y", "1");
  document.body.appendChild(c1);
  c1.setAttribute("y", "2");
  c1.setAttribute("y", "3");
  c1.setAttribute("y", "4");
}, 1);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(5)).toEqual([
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
                    children: [],
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
      [
        {
          addedNodes: [
            {
              attributes: {
                y: "4", // The value should be "1" when added
              },
              children: [],
              nodeId: 5,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      // All intermediate attribute values are missing and we now receive 3 attribute changes to the same value
      [
        {
          attribute: "y",
          newValue: "4",
          nodeId: 5,
          type: "attributeChange",
        },
      ],
      [
        {
          attribute: "y",
          newValue: "4",
          nodeId: 5,
          type: "attributeChange",
        },
      ],
      [
        {
          attribute: "y",
          newValue: "4",
          nodeId: 5,
          type: "attributeChange",
        },
      ],
    ]);
  });

  test("multiple element attribute changes and removal observation", async () => {
    /* TODO - this test is not desirable behaviour, but is here to ensure that
        the handling of this case is done without errors. If a more correct
        implementation fails this test then change the test.
    */
    /* This test checks that regardless of the order of attribute changes still
        results in an eventually-consistent client view.
     */
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<script>
setTimeout(() => {
  const c1 = document.createElement("m-cube");
  c1.setAttribute("y", "1");
  document.body.appendChild(c1);
  c1.setAttribute("y", "2");
  c1.setAttribute("y", "3");
  c1.removeAttribute("y");
}, 1);
</script>`);

    const clientWs = new MockWebsocket();
    doc.addWebSocket(clientWs as unknown as WebSocket);

    expect(await clientWs.waitForTotalMessageCount(5)).toEqual([
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
                    children: [],
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
      [
        {
          addedNodes: [
            {
              attributes: {
                // The value of "y" should be "1" when added
              },
              children: [],
              nodeId: 5,
              tag: "M-CUBE",
              type: "element",
            },
          ],
          nodeId: 4,
          previousNodeId: null,
          removedNodes: [],
          type: "childrenChanged",
        },
      ],
      // All intermediate attribute changes are missing and we now get 3 removals for an attribute that was never set
      [
        {
          attribute: "y",
          newValue: null,
          nodeId: 5,
          type: "attributeChange",
        },
      ],
      [
        {
          attribute: "y",
          newValue: null,
          nodeId: 5,
          type: "attributeChange",
        },
      ],
      [
        {
          attribute: "y",
          newValue: null,
          nodeId: 5,
          type: "attributeChange",
        },
      ],
    ]);
  });
});
