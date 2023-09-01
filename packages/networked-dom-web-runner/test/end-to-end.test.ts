import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { LogMessage } from "@mml-io/observable-dom-common";

import { waitFor } from "./test-util";
import { IframeObservableDOMFactory, NetworkedDOMWebRunnerClient } from "../build/index";

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
