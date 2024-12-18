import { LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import { LogMessage } from "@mml-io/observable-dom-common";

import { EditableNetworkedDOM } from "../src";

let currentDoc: EditableNetworkedDOM | null = null;
afterEach(() => {
  if (currentDoc) {
    currentDoc.dispose();
    currentDoc = null;
  }
});

function waitUntil(checkFn: () => boolean) {
  return new Promise((resolve) => {
    if (checkFn()) {
      resolve(null);
      return;
    }

    const interval = setInterval(() => {
      if (checkFn()) {
        clearInterval(interval);
        clearTimeout(maxTimeout);
        resolve(null);
      }
    }, 10);

    const maxTimeout = setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 3000);
  });
}

describe("logging", () => {
  test("buffered console logging during document init", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file:///test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`
<m-cube color="red"></m-cube>
<script>
  console.log("foo");
</script>
`);

    await waitUntil(() => loggedMessages.length >= 1);

    expect(loggedMessages).toEqual([
      {
        level: "log",
        content: ["foo"],
      },
    ]);
  });

  test("unbuffered console logging after document init", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file:///test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`
<m-cube color="red"></m-cube>
<script>
  window.addEventListener("DOMContentLoaded", (event) => {
    setTimeout(() => {
      console.log("foo");
    }, 10);
    setTimeout(() => {
      console.error("bar");
    }, 20);
  });
</script>
`);

    await waitUntil(() => loggedMessages.length >= 2);

    expect(loggedMessages).toEqual([
      {
        level: "log",
        content: ["foo"],
      },
      {
        level: "error",
        content: ["bar"],
      },
    ]);
  });

  test("unhandled exceptions", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file:///test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`
<m-cube color="red"></m-cube>
<script>
  setTimeout(() => {
    consolelog("foo");
  }, 10);
</script>
`);

    await waitUntil(() => loggedMessages.length >= 1);

    const logMessage = loggedMessages[0];

    expect(logMessage.content[0]).toBeInstanceOf(Error);
    expect(logMessage.content[0].message).toBe(
      "Uncaught [ReferenceError: consolelog is not defined]",
    );
  });

  test("correct console logging behaviour after document reload", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file:///test.html",
      LocalObservableDOMFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`
<m-cube color="red"></m-cube>
<script>
  console.log("foo");
  setTimeout(() => {
    console.log("bar");
  }, 10);
</script>
`);

    await waitUntil(() => loggedMessages.length >= 2);

    doc.reload();

    // Wait long enough to ensure that no additional, unexpected logs get added
    await new Promise((r) => setTimeout(r, 500));

    expect(loggedMessages).toEqual([
      {
        level: "log",
        content: ["foo"],
      },
      {
        level: "log",
        content: ["bar"],
      },
      {
        level: "log",
        content: ["foo"],
      },
      {
        level: "log",
        content: ["bar"],
      },
    ]);
  });
});
