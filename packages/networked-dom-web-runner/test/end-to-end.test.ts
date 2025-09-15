import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { LogMessage } from "@mml-io/observable-dom-common";

import { IframeObservableDOMFactory, NetworkedDOMWebRunnerClient } from "../build/index";
import { waitFor } from "./test-util";

const jestConsoleLog = console.log;
const jestConsoleInfo = console.info;
const jestConsoleWarn = console.warn;
const jestConsoleError = console.error;

// Suppress log output during these test because the test itself is logging and errors can confuse the test output.
beforeEach(() => {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
});

afterEach(() => {
  console.log = jestConsoleLog;
  console.info = jestConsoleInfo;
  console.warn = jestConsoleWarn;
  console.error = jestConsoleError;
});

test("networked-dom-web-runner end-to-end", async () => {
  const logs: LogMessage[] = [];

  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    false,
    (logMessage) => {
      logs.push(logMessage);
    },
  );

  const clientsHolder = document.createElement("div");
  document.body.append(clientsHolder);

  const client = new NetworkedDOMWebRunnerClient();
  clientsHolder.append(client.element);
  client.connect(networkedDOMDocument);

  networkedDOMDocument.load(
    `<div 
      data-some-id="test-element" 
      onclick="
        this.setAttribute('data-some-attr','new-value'); 
        console.log('level-log'); 
        console.info('level-info'); 
        console.warn('level-warn'); 
        console.error('level-error'); 
      "
    ></div>

    <div 
      data-some-id="throwing-element" 
      onclick="
        undef[1];
      "
    ></div>`,
  );

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='test-element']").length > 0;
  });
  const testElement = client.element.querySelectorAll("[data-some-id='test-element']")[0];

  testElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await waitFor(() => testElement.getAttribute("data-some-attr") === "new-value");

  expect(logs).toEqual([
    expect.objectContaining({
      level: "log",
      content: ["level-log"],
    }),

    expect.objectContaining({
      level: "info",
      content: ["level-info"],
    }),

    expect.objectContaining({
      level: "warn",
      content: ["level-warn"],
    }),

    expect.objectContaining({
      level: "error",
      content: ["level-error"],
    }),
  ]);

  logs.length = 0;

  const throwingElement = client.element.querySelectorAll("[data-some-id='throwing-element']")[0];
  throwingElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  await waitFor(() => {
    return logs.length > 0;
  });

  expect(logs).toEqual([
    expect.objectContaining({
      level: "system",
      content: [
        expect.objectContaining({
          message: "undef is not defined",
          type: "ReferenceError",
        }),
      ],
    }),
  ]);

  networkedDOMDocument.load(`<div data-some-id="different-element"></div>`);

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='different-element']").length > 0;
  });

  networkedDOMDocument.dispose();
});
