/**
 * @jest-environment jsdom
 */

import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { LogMessage } from "@mml-io/observable-dom-common";
import { AudioContext } from "standardized-audio-context-mock";

import { waitFor } from "./test-util";
import { IframeObservableDOMFactory, NetworkedDOMWebRunnerClient } from "../build/index";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
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

  await waitFor(() => true);

  expect(logs).toContainEqual(
    expect.objectContaining({
      level: "log",
      content: ["level-log"],
    }),
  );

  expect(logs).toContainEqual(
    expect.objectContaining({
      level: "info",
      content: ["level-info"],
    }),
  );

  expect(logs).toContainEqual(
    expect.objectContaining({
      level: "warn",
      content: ["level-warn"],
    }),
  );

  expect(logs).toContainEqual(
    expect.objectContaining({
      level: "error",
      content: ["level-error"],
    }),
  );

  expect(logs).toContainEqual(
    expect.objectContaining({
      level: "system",
      content: expect.objectContaining({
        message: "undef is not defined",
        type: "ReferenceError",
      }),
    }),
  );

  networkedDOMDocument.dispose();
});
