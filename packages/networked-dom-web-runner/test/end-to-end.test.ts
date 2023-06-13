/**
 * @jest-environment jsdom
 */

import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { AudioContext } from "standardized-audio-context-mock";

import { waitFor } from "./test-util";
import { IframeObservableDOMFactory, NetworkedDOMWebRunnerClient } from "../build/index";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
});
test("networked-dom-web-runner end-to-end", async () => {
  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    false,
  );

  const clientsHolder = document.createElement("div");
  document.body.append(clientsHolder);

  const client = new NetworkedDOMWebRunnerClient();
  clientsHolder.append(client.element);
  client.connect(networkedDOMDocument);

  networkedDOMDocument.load(
    "<div data-some-id=\"test-element\" onclick=\"this.setAttribute('data-some-attr','new-value')\"></div>",
  );

  await waitFor(() => {
    return client.element.querySelectorAll("[data-some-id='test-element']").length > 0;
  });
  const testElement = client.element.querySelectorAll("[data-some-id='test-element']")[0];

  testElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await waitFor(() => testElement.getAttribute("data-some-attr") === "new-value");

  networkedDOMDocument.dispose();
});
