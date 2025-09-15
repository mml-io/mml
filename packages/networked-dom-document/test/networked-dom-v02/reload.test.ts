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

describe("reloading - v0.2", () => {
  test("add-within-group-on-reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-cube color="red"></m-cube>
<m-cube color="green"></m-cube>
<m-cube color="blue"></m-cube>
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
                      attributes: [["color", "green"]],
                      children: [],
                      nodeId: 6,
                      tag: "M-CUBE",
                      type: "element",
                    },
                    {
                      attributes: [["color", "blue"]],
                      children: [],
                      nodeId: 7,
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
  <m-group y="2">
    <m-cube color="red"></m-cube>
    <m-cube color="green"></m-cube>
    <m-cube color="blue"></m-cube>
  </m-group>
`);

    expect(await clientWs.waitForTotalMessageCount(6, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        nodeId: 4,
        removedNodes: [5],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [["y", "2"]],
            children: [
              {
                attributes: [["color", "red"]],
                children: [],
                nodeId: 9,
                tag: "M-CUBE",
                type: "element",
              },
              {
                attributes: [["color", "green"]],
                children: [],
                nodeId: 10,
                tag: "M-CUBE",
                type: "element",
              },
              {
                attributes: [["color", "blue"]],
                children: [],
                nodeId: 8,
                tag: "M-CUBE",
                type: "element",
              },
            ],
            nodeId: 5,
            tag: "M-GROUP",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: null,
        type: "childrenAdded",
      },
      {
        nodeId: 4,
        removedNodes: [6],
        type: "childrenRemoved",
      },
      {
        nodeId: 4,
        removedNodes: [7],
        type: "childrenRemoved",
      },
    ]);
  });

  test("move-to-within-group-on-reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-plane color="blue" width="20" height="20" rx="-90"></m-plane>
<m-group y="2">
  <m-label id="some-label" width="2" y="4"></m-label>
</m-group>
<script>
  // Empty in this version
</script>
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
                      attributes: [
                        ["color", "blue"],
                        ["width", "20"],
                        ["height", "20"],
                        ["rx", "-90"],
                      ],
                      children: [],
                      nodeId: 5,
                      tag: "M-PLANE",
                      type: "element",
                    },
                    {
                      attributes: [["y", "2"]],
                      children: [
                        {
                          attributes: [
                            ["id", "some-label"],
                            ["width", "2"],
                            ["y", "4"],
                          ],
                          children: [],
                          nodeId: 7,
                          tag: "M-LABEL",
                          type: "element",
                        },
                      ],
                      nodeId: 6,
                      tag: "M-GROUP",
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
<m-group y="2">
  <m-plane color="blue" width="20" height="20" rx="-90"></m-plane>
  <m-label id="some-label" width="2" y="4"></m-label>
</m-group>
<script>
  setTimeout(() => {
    document
      .getElementById("some-label")
      .setAttribute("content", "Updated in version two");
  }, 100);
</script>
`);

    expect(await clientWs.waitForTotalMessageCount(5, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        // Removes the original m-plane (5) from the BODY (4)
        nodeId: 4, // BODY
        removedNodes: [5],
        type: "childrenRemoved",
      },
      {
        // Adds a new m-group (5) to the BODY (4)
        addedNodes: [
          {
            attributes: [["y", "2"]],
            children: [
              {
                attributes: [
                  ["color", "blue"],
                  ["width", "20"],
                  ["height", "20"],
                  ["rx", "-90"],
                ],
                children: [],
                nodeId: 8,
                tag: "M-PLANE",
                type: "element",
              },
              {
                attributes: [
                  ["id", "some-label"],
                  ["width", "2"],
                  ["y", "4"],
                ],
                children: [],
                nodeId: 9,
                tag: "M-LABEL",
                type: "element",
              },
            ],
            nodeId: 5,
            tag: "M-GROUP",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: null,
        type: "childrenAdded",
      },
      {
        // Removes the original m-group (6) from the BODY (4)
        nodeId: 4,
        removedNodes: [6],
        type: "childrenRemoved",
      },
    ]);

    expect(await clientWs.waitForTotalMessageCount(6, 5)).toEqual([
      {
        attributes: [["content", "Updated in version two"]],
        nodeId: 9,
        type: "attributesChanged",
      },
    ]);
  });

  test("remapping-on-reload-and-click", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(
      `
<m-model></m-model>
<m-cube></m-cube>`,
    );

    const clientWs = new MockWebsocketV02();
    doc.addWebSocket(clientWs as unknown as WebSocket);
    clientWs.sendToServer({
      type: "connectUsers",
      connectionIds: [1], // Should be internal id 1
      connectionTokens: [null],
    });

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
                      attributes: [],
                      children: [],
                      nodeId: 5,
                      tag: "M-MODEL",
                      type: "element",
                    },
                    {
                      attributes: [],
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

    doc.load(`
<m-group z="-20" y="10">
  <m-label onclick="this.setAttribute('content','new-content')" content="click me"></m-label>
</m-group>
<m-model></m-model>
<m-cube></m-cube>`);

    expect(await clientWs.waitForTotalMessageCount(7, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        nodeId: 4,
        removedNodes: [5],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [
              ["z", "-20"],
              ["y", "10"],
            ],
            children: [
              {
                attributes: [["content", "click me"]],
                children: [],
                nodeId: 9,
                tag: "M-LABEL",
                type: "element",
              },
            ],
            nodeId: 5,
            tag: "M-GROUP",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: null,
        type: "childrenAdded",
      },
      {
        nodeId: 4,
        removedNodes: [6],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [],
            children: [],
            nodeId: 7,
            tag: "M-MODEL",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: 5,
        type: "childrenAdded",
      },
      {
        addedNodes: [
          {
            attributes: [],
            children: [],
            nodeId: 8,
            tag: "M-CUBE",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: 7, // m-model
        type: "childrenAdded",
      },
    ]);

    clientWs.sendToServer({
      type: "event",
      nodeId: 9,
      connectionId: 1,
      name: "click",
      bubbles: true,
      params: {},
    });

    expect(await clientWs.waitForTotalMessageCount(8, 7)).toEqual([
      {
        attributes: [["content", "new-content"]],
        nodeId: 9,
        type: "attributesChanged",
      },
    ]);
  });

  test("should not send hidden elements on reload", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
    currentDoc = doc;
    doc.load(`
<m-group id="one" visible-to="0">
  <m-cube></m-cube>
</m-group>
<m-group id="two"></m-group>
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
                      attributes: [["id", "two"]],
                      children: [],
                      nodeId: 7,
                      tag: "M-GROUP",
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

    doc.load(`<m-light id="zero"></m-light>
<m-group id="one" visible-to="0">
  <m-cube></m-cube>
</m-group>
<m-group id="two"></m-group>
`);

    expect(await clientWs.waitForTotalMessageCount(5, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        addedNodes: [
          {
            attributes: [["id", "zero"]],
            children: [],
            nodeId: 5,
            tag: "M-LIGHT",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: null,
        type: "childrenAdded",
      },
      {
        nodeId: 4,
        removedNodes: [7],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [["id", "two"]],
            children: [],
            nodeId: 8,
            tag: "M-GROUP",
            type: "element",
          },
        ],
        nodeId: 4,
        previousNodeId: 5, // m-light
        type: "childrenAdded",
      },
    ]);
  });

  test("svg elements with self-closing tags", async () => {
    const doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory, false);
    currentDoc = doc;
    doc.load(`
<m-overlay anchor="center">
  <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect id="one-button" />
    <text id="one-text">One</text>

    <rect id="two-button" />
  </svg>
</m-overlay>
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
                      attributes: [["anchor", "center"]],
                      children: [
                        {
                          nodeId: 6,
                          text: "\n  ",
                          type: "text",
                        },
                        {
                          attributes: [
                            ["width", "100"],
                            ["height", "200"],
                            ["xmlns", "http://www.w3.org/2000/svg"],
                          ],
                          children: [
                            {
                              nodeId: 8,
                              text: "\n    ",
                              type: "text",
                            },
                            {
                              attributes: [["id", "one-button"]],
                              children: [],
                              nodeId: 9,
                              tag: "RECT",
                              type: "element",
                            },
                            {
                              nodeId: 10,
                              text: "\n    ",
                              type: "text",
                            },
                            {
                              attributes: [["id", "one-text"]],
                              children: [
                                {
                                  nodeId: 12,
                                  text: "One",
                                  type: "text",
                                },
                              ],
                              nodeId: 11,
                              tag: "TEXT",
                              type: "element",
                            },
                            {
                              nodeId: 13,
                              text: "\n\n    ",
                              type: "text",
                            },
                            {
                              attributes: [["id", "two-button"]],
                              children: [],
                              nodeId: 14,
                              tag: "RECT",
                              type: "element",
                            },
                            {
                              nodeId: 15,
                              text: "\n  ",
                              type: "text",
                            },
                          ],
                          nodeId: 7,
                          tag: "SVG",
                          type: "element",
                        },
                        {
                          nodeId: 16,
                          text: "\n",
                          type: "text",
                        },
                      ],
                      nodeId: 5,
                      tag: "M-OVERLAY",
                      type: "element",
                    },
                    {
                      nodeId: 17,
                      text: "\n",
                      type: "text",
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
<m-overlay anchor="center">
  <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
    <text id="one-text">One</text>

    <rect id="two-button" />
  </svg>
</m-overlay>
`);

    expect(await clientWs.waitForTotalMessageCount(10, 1)).toEqual([
      {
        documentTime: expect.any(Number),
        type: "documentTime",
      },
      {
        nodeId: 7,
        removedNodes: [9],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [["id", "one-text"]],
            children: [
              {
                nodeId: 18,
                text: "One",
                type: "text",
              },
            ],
            nodeId: 9,
            tag: "TEXT",
            type: "element",
          },
        ],
        nodeId: 7,
        previousNodeId: 8,
        type: "childrenAdded",
      },
      {
        nodeId: 10,
        text: "\n\n    ",
        type: "textChanged",
      },
      {
        nodeId: 7,
        removedNodes: [11],
        type: "childrenRemoved",
      },
      {
        addedNodes: [
          {
            attributes: [["id", "two-button"]],
            children: [],
            nodeId: 12,
            tag: "RECT",
            type: "element",
          },
        ],
        nodeId: 7,
        previousNodeId: 10,
        type: "childrenAdded",
      },
      {
        nodeId: 13,
        text: "\n  ",
        type: "textChanged",
      },
      {
        nodeId: 7,
        removedNodes: [14],
        type: "childrenRemoved",
      },
      {
        nodeId: 7,
        removedNodes: [15],
        type: "childrenRemoved",
      },
    ]);
  });
});
