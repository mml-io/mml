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
            expect(domRunner.getDocument().childNodes).toHaveLength(1);
            expect(domRunner.getDocument().childNodes[0].nodeName).toEqual("HTML");
            expect(domRunner.getDocument().childNodes[0].childNodes).toHaveLength(2);
            expect(domRunner.getDocument().childNodes[0].childNodes[0].nodeName).toEqual("HEAD");
            expect(domRunner.getDocument().childNodes[0].childNodes[1].nodeName).toEqual("BODY");
            expect(domRunner.getDocument().childNodes[0].childNodes[1].childNodes).toHaveLength(7);
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[0].nodeName,
            ).toEqual("M-CUBE");
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[1].nodeName,
            ).toEqual("#text");
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[2].nodeName,
            ).toEqual("M-SPHERE");
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[3].nodeName,
            ).toEqual("#text");
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[4].nodeName,
            ).toEqual("M-GROUP");
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[5].nodeName,
            ).toEqual("#text");
            expect(
              domRunner.getDocument().childNodes[0].childNodes[1].childNodes[6].nodeName,
            ).toEqual("SCRIPT");
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

    expect(allMessages[0]).toEqual({
      loaded: true,
    });

    expect(allMessages[1].mutationList).toHaveLength(2);
    expect(allMessages[1].mutationList![0].type).toEqual("childList");
    expect(allMessages[1].mutationList![0].addedNodes).toHaveLength(1);
    expect(allMessages[1].mutationList![0].addedNodes[0].nodeName).toEqual("M-IMAGE");

    expect(allMessages[1].mutationList![1].type).toEqual("attributes");
    expect(allMessages[1].mutationList![1].attributeName).toEqual("data-foo");
    expect(allMessages[1].mutationList![1].oldValue).toEqual(null);
    expect(allMessages[1].mutationList![1].target.nodeName).toEqual("M-SPHERE");

    expect(allMessages[2].mutationList).toHaveLength(1);
    expect(allMessages[2].mutationList![0].type).toEqual("attributes");
    expect(allMessages[2].mutationList![0].attributeName).toEqual("data-foo");
    expect(allMessages[2].mutationList![0].target.nodeName).toEqual("M-SPHERE");
  }, 10000);
});
