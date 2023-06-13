import { LocalObservableDomFactory } from "@mml-io/networked-dom-server";
import { LogMessage } from "@mml-io/observable-dom-common";

































describe("logging", () => {
  test("buffered console logging during document init", async () => {
    const loggedMessages: Array<LogMessage> = [];

    const doc = new EditableNetworkedDOM(
      "file:///test.html",
      LocalObservableDomFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`






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
      LocalObservableDomFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`













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
      LocalObservableDomFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`








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
      LocalObservableDomFactory,
      true,
      (logMessage: LogMessage) => {
        loggedMessages.push(logMessage);
      },
    );
    currentDoc = doc;
    doc.load(`









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

