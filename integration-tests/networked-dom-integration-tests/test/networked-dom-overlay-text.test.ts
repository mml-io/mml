import { afterEach } from "vitest";

import { formatHTML } from "./test-util";
import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - m-overlay + text - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    afterEach(() => {
      // Clean up DOM to prevent ID collisions between tests
      document.body.innerHTML = "";
    });

    test("svg elements with self-closing tags", async () => {
      const testCase = new TestCaseNetworkedDOMDocument(false);
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`
<m-overlay anchor="center">
  <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect id="one-button" />
    <text id="one-text">One</text>

    <rect id="two-button" />
  </svg>
</m-overlay>
`);

      const expected1 = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-overlay anchor="center">
      <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect id="one-button">
        </rect>
        <text id="one-text">One</text>
        <rect id="two-button">
        </rect>
      </svg>
    </m-overlay>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 1 : 1);

      if (isV01) {
        expect(client1.getV01DecodedMessages()).toEqual([
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
                              anchor: "center",
                            },
                            children: [
                              {
                                nodeId: 6,
                                text: "\n  ",
                                type: "text",
                              },
                              {
                                attributes: {
                                  height: "200",
                                  width: "100",
                                  xmlns: "http://www.w3.org/2000/svg",
                                },
                                children: [
                                  {
                                    nodeId: 8,
                                    text: "\n    ",
                                    type: "text",
                                  },
                                  {
                                    attributes: {
                                      id: "one-button",
                                    },
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
                                    attributes: {
                                      id: "one-text",
                                    },
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
                                    attributes: {
                                      id: "two-button",
                                    },
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
          ],
        ]);
      } else {
        expect(client1.getV02DecodedMessages()).toEqual([
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
      }

      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected1}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected1);

      // Reload the document with changes
      testCase.doc.load(`
<m-overlay anchor="center">
  <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
    <text id="one-text">One</text>

    <rect id="two-button" />
  </svg>
</m-overlay>
`);

      const expected2 = formatHTML(`<html>
    <head>
    </head>
    <body>
      <m-overlay anchor="center">
        <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
          <text id="one-text">One</text>
          <rect id="two-button">
          </rect>
        </svg>
      </m-overlay>
    </body>
  </html>`);
      await client1.waitForAllClientMessages(isV01 ? 10 : 10);

      if (isV01) {
        expect(client1.getV01DecodedMessages(1)).toEqual([
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
          [
            {
              addedNodes: [],
              nodeId: 7,
              previousNodeId: null,
              removedNodes: [9],
              type: "childrenChanged",
            },
          ],
          [
            {
              addedNodes: [
                {
                  attributes: {
                    id: "one-text",
                  },
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
              removedNodes: [],
              type: "childrenChanged",
            },
          ],
          [
            {
              nodeId: 10,
              text: "\n\n    ",
              type: "textChanged",
            },
          ],
          [
            {
              addedNodes: [],
              nodeId: 7,
              previousNodeId: null,
              removedNodes: [11],
              type: "childrenChanged",
            },
          ],
          [
            {
              addedNodes: [
                {
                  attributes: {
                    id: "two-button",
                  },
                  children: [],
                  nodeId: 12,
                  tag: "RECT",
                  type: "element",
                },
              ],
              nodeId: 7,
              previousNodeId: 10,
              removedNodes: [],
              type: "childrenChanged",
            },
          ],
          [
            {
              nodeId: 13,
              text: "\n  ",
              type: "textChanged",
            },
          ],
          [
            {
              addedNodes: [],
              nodeId: 7,
              previousNodeId: null,
              removedNodes: [14],
              type: "childrenChanged",
            },
          ],
          [
            {
              addedNodes: [],
              nodeId: 7,
              previousNodeId: null,
              removedNodes: [15],
              type: "childrenChanged",
            },
          ],
        ]);
      } else {
        expect(client1.getV02DecodedMessages(1)).toEqual([
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
      }

      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected2}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected2);
    });
  },
);
