import { DOMRunnerMessage, JSDOMRunnerFactory } from "../src";
import { DOMToJSON } from "./DOMToJSON";

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
<svg><defs><linearGradient><feDropShadow></feDropShadow></linearGradient></defs></svg>
<svg><rect/></svg>
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
                          childNodes: [
                            {
                              childNodes: [
                                {
                                  childNodes: [
                                    {
                                      node: "feDropShadow",
                                    },
                                  ],
                                  node: "linearGradient",
                                },
                              ],
                              node: "defs",
                            },
                          ],
                          node: "svg",
                        },
                        {
                          childNodes: [
                            {
                              node: "rect",
                            },
                          ],
                          node: "svg",
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

  test("crypto.subtle is available and functional", async () => {
    const allMessages: Array<DOMRunnerMessage> = [];

    JSDOMRunnerFactory(
      "http://example.com/index.html",
      `
<m-cube id="result"></m-cube>
<script>
  setTimeout(async () => {
    const el = document.getElementById("result");
    try {
      // Test crypto.getRandomValues
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const hasRandomValues = array.some(v => v !== 0);
      el.setAttribute("data-random", hasRandomValues ? "ok" : "fail");

      // Test crypto.subtle.digest (SHA-256)
      const data = new TextEncoder().encode("hello");
      const hash = await crypto.subtle.digest("SHA-256", data);
      const hashHex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      el.setAttribute("data-sha256", hashHex);

      // Test crypto.subtle.generateKey + sign + verify (HMAC, as used in JWT)
      const key = await crypto.subtle.generateKey(
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, data);
      const valid = await crypto.subtle.verify("HMAC", key, signature, data);
      el.setAttribute("data-hmac", valid ? "ok" : "fail");
    } catch(err) {
      el.setAttribute("data-error", err.message);
    }
  }, 1);
</script>`,
      {},
      (domRunnerMessage: DOMRunnerMessage) => {
        allMessages.push(domRunnerMessage);
      },
    );

    // Wait for at least 1 attribute mutation (could be data-error or data-hmac as final)
    await waitUntil(() => {
      const mutations = allMessages.flatMap((m) => m.mutationList ?? []);
      const attrMutations = mutations.filter((m) => m.type === "attributes");
      // Either we get 3 success attributes, or a data-error attribute
      const hasError = attrMutations.some((m) => m.attributeName === "data-error");
      const hasHmac = attrMutations.some((m) => m.attributeName === "data-hmac");
      return hasError || hasHmac;
    }, "Waiting for crypto attribute mutations");

    const attributeMutations = allMessages
      .flatMap((m) => m.mutationList ?? [])
      .filter((m) => m.type === "attributes");

    const findAttr = (name: string) => attributeMutations.find((m) => m.attributeName === name);

    // No errors should have occurred
    if (findAttr("data-error")) {
      throw new Error(
        `Crypto test errored inside JSDOM: ${(findAttr("data-error")!.target as any).getAttribute("data-error")}`,
      );
    }

    // crypto.getRandomValues produced non-zero bytes
    expect(findAttr("data-random")).toBeDefined();
    expect((findAttr("data-random")!.target as any).getAttribute("data-random")).toEqual("ok");

    // crypto.subtle.digest produced the correct SHA-256 hash
    expect(findAttr("data-sha256")).toBeDefined();
    expect((findAttr("data-sha256")!.target as any).getAttribute("data-sha256")).toEqual(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );

    // crypto.subtle HMAC sign + verify round-tripped successfully
    expect(findAttr("data-hmac")).toBeDefined();
    expect((findAttr("data-hmac")!.target as any).getAttribute("data-hmac")).toEqual("ok");
  }, 10000);
});
