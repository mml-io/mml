import { DOMToJSON } from "./DOMToJSON";
import { DOMRunnerMessage, JSDOMRunnerFactory } from "../src";

export function waitUntil(checkFn: () => boolean, message?: string) {
  return new Promise((resolve, reject) => {
    if (checkFn()) {
      resolve(null);
      return;
    }

    let maxTimeout: NodeJS.Timeout | null = null;
    const interval = setInterval(() => {
      if (checkFn()) {
        clearInterval(interval);
        if (maxTimeout) {
          clearTimeout(maxTimeout);
        }
        resolve(null);
      }
    }, 10);

    maxTimeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`waitUntil timed out${message ? `: ${message}` : ""}`));
    }, 3000);
  });
}

describe("JSDOMRunner", () => {
  test("attribute replacement", async () => {
    const allMessages: Array<DOMRunnerMessage> = [];

    let initialLoadError: Error | null = null;
    const domRunner = JSDOMRunnerFactory(
      "http://example.com/index.html",
      `
<m-cube onclick="this.setAttribute('color', 'red');"></m-cube>
<m-sphere id="my-sphere"></m-sphere>
<m-group id="my-group"></m-group>
<script>
  let count = 0;
  const sphere = document.getElementById("my-sphere");
  setTimeout(() => {
    const group = document.getElementById("my-group");
    const el = document.createElement("m-image");
    el.setAttribute("src", "http://example.com/image.png");
    group.appendChild(el);
    sphere.setAttribute("data-foo", count++);
    
    setTimeout(() => {
      sphere.setAttribute("data-foo", count++);
    }, 1);
  }, 1)
</script>`,
      {},
      (domRunnerMessage: DOMRunnerMessage) => {
        allMessages.push(domRunnerMessage);
        if (domRunnerMessage.loaded) {
          try {
            expect(
              DOMToJSON(domRunner.getDocument(), {
                includeScriptContents: false,
                ignoreWhitespaceTextNodes: true,
              }),
            ).toEqual({
              childNodes: [
                {
                  childNodes: [
                    {
                      node: "HEAD",
                    },
                    {
                      childNodes: [
                        {
                          node: "M-CUBE onclick=\"this.setAttribute('color', 'red');\"",
                        },
                        {
                          node: 'M-SPHERE id="my-sphere"',
                        },
                        {
                          node: 'M-GROUP id="my-group"',
                        },
                        {
                          childNodes: [],
                          node: "SCRIPT",
                        },
                      ],
                      node: "BODY",
                    },
                  ],
                  node: "HTML",
                },
              ],
              node: "#document",
            });
          } catch (e) {
            initialLoadError = e;
          }
        }
      },
    );

    await waitUntil(() => allMessages.length === 3, "Waiting for all messages");

    if (initialLoadError) {
      throw initialLoadError;
    }

    const [initialLoad, firstMessage, secondMessage] = allMessages;

    expect(initialLoad).toEqual({
      loaded: true,
    });

    expect(firstMessage.mutationList).toHaveLength(2);
    const [firstMessageMutation1, firstMessageMutation2] = firstMessage.mutationList!;
    expect(firstMessageMutation1.type).toEqual("childList");
    expect(firstMessageMutation1.addedNodes).toHaveLength(1);
    expect(firstMessageMutation1.addedNodes[0].nodeName).toEqual("M-IMAGE");

    expect(firstMessageMutation2.type).toEqual("attributes");
    expect(firstMessageMutation2.attributeName).toEqual("data-foo");
    expect(firstMessageMutation2.oldValue).toEqual(null);
    expect(firstMessageMutation2.target.nodeName).toEqual("M-SPHERE");

    expect(secondMessage.mutationList).toHaveLength(1);
    const [secondMessageMutation1] = secondMessage.mutationList!;
    expect(secondMessageMutation1.type).toEqual("attributes");
    expect(secondMessageMutation1.attributeName).toEqual("data-foo");
    expect(secondMessageMutation1.target.nodeName).toEqual("M-SPHERE");
  }, 10000);

  test("element removal with child removal and re-add", async () => {
    const allMessages: Array<DOMRunnerMessage> = [];

    let initialLoadError: Error | null = null;
    const domRunner = JSDOMRunnerFactory(
      "http://example.com/index.html",
      `
<m-cube color="red" id="c1">
  <m-cube color="green" id="c2">
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");

  setTimeout(() => {
    c2.remove();
    document.body.appendChild(c1);
    c1.appendChild(c2);
  }, 1);
</script>
`,
      {},
      (domRunnerMessage: DOMRunnerMessage) => {
        allMessages.push(domRunnerMessage);
        if (domRunnerMessage.loaded) {
          try {
            expect(
              DOMToJSON(domRunner.getDocument(), {
                includeScriptContents: false,
                ignoreWhitespaceTextNodes: true,
              }),
            ).toEqual({
              node: "#document",
              childNodes: [
                {
                  node: "HTML",
                  childNodes: [
                    {
                      node: "HEAD",
                    },
                    {
                      node: "BODY",
                      childNodes: [
                        {
                          node: 'M-CUBE color="red" id="c1"',
                          childNodes: [
                            {
                              node: 'M-CUBE color="green" id="c2"',
                            },
                          ],
                        },
                        {
                          node: "SCRIPT",
                          childNodes: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            });
          } catch (e) {
            initialLoadError = e;
          }
        }
      },
    );

    await waitUntil(() => allMessages.length === 2, "Waiting for all messages");

    if (initialLoadError) {
      throw initialLoadError;
    }

    const [initialLoad, firstMessage] = allMessages;
    expect(initialLoad).toEqual({
      loaded: true,
    });

    expect(firstMessage.mutationList).toHaveLength(4);
    const [
      firstMessageMutation1,
      firstMessageMutation2,
      firstMessageMutation3,
      firstMessageMutation4,
    ] = firstMessage.mutationList!;
    expect(firstMessageMutation1.type).toEqual("childList");
    expect(firstMessageMutation1.addedNodes).toHaveLength(0);
    expect(firstMessageMutation1.removedNodes).toHaveLength(1);
    expect(firstMessageMutation1.removedNodes[0].nodeName).toEqual("M-CUBE");
    expect((firstMessageMutation1.removedNodes[0] as any).attributes.id.value).toEqual("c2");

    expect(firstMessageMutation2.type).toEqual("childList");
    expect(firstMessageMutation2.removedNodes).toHaveLength(1);
    expect(firstMessageMutation2.removedNodes[0].nodeName).toEqual("M-CUBE");
    expect((firstMessageMutation2.removedNodes[0] as any).attributes.id.value).toEqual("c1");
    expect(firstMessageMutation2.removedNodes[0].childNodes[0]).toHaveLength(3);
    expect(firstMessageMutation2.removedNodes[0].childNodes[0].nodeName).toEqual("#text");
    expect(firstMessageMutation2.removedNodes[0].childNodes[1].nodeName).toEqual("#text");
    expect(firstMessageMutation2.removedNodes[0].childNodes[2].nodeName).toEqual("M-CUBE");
    expect(
      (firstMessageMutation2.removedNodes[0].childNodes[2] as any).attributes.id.value,
    ).toEqual("c2");
    expect(firstMessageMutation2.addedNodes).toHaveLength(0);

    expect(firstMessageMutation3.type).toEqual("childList");
    expect(firstMessageMutation3.removedNodes).toHaveLength(0);
    expect(firstMessageMutation3.addedNodes).toHaveLength(1);
    expect(firstMessageMutation3.addedNodes[0].nodeName).toEqual("M-CUBE");
    expect((firstMessageMutation3.addedNodes[0] as any).attributes.id.value).toEqual("c1");
    expect(firstMessageMutation3.addedNodes[0].childNodes[0]).toHaveLength(3);
    expect(firstMessageMutation3.addedNodes[0].childNodes[0].nodeName).toEqual("#text");
    expect(firstMessageMutation3.addedNodes[0].childNodes[1].nodeName).toEqual("#text");
    expect(firstMessageMutation3.addedNodes[0].childNodes[2].nodeName).toEqual("M-CUBE");
    expect((firstMessageMutation3.addedNodes[0].childNodes[2] as any).attributes.id.value).toEqual(
      "c2",
    );

    expect(firstMessageMutation4.type).toEqual("childList");
    expect(firstMessageMutation4.removedNodes).toHaveLength(0);
    expect(firstMessageMutation4.addedNodes).toHaveLength(1);
    expect(firstMessageMutation4.addedNodes[0].nodeName).toEqual("M-CUBE");
    expect((firstMessageMutation4.addedNodes[0] as any).attributes.id.value).toEqual("c2");
  }, 10000);
});
