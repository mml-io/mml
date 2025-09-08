import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { LocalObservableDOMFactory } from "@mml-io/networked-dom-server";

import { formatHTML, htmlStringWithFilters } from "./test-util";
import { TestCaseNetworkedDOMClient } from "./TestCaseNetworkedDOMClient";

export class TestCaseNetworkedDOMDocument {
  public doc: EditableNetworkedDOM;

  constructor(ignoreTextNodes = true) {
    this.doc = new EditableNetworkedDOM(
      "file://test.html",
      LocalObservableDOMFactory,
      ignoreTextNodes,
    );
  }

  createClient(useV01 = false) {
    const testClient = new TestCaseNetworkedDOMClient(useV01);
    this.doc.addWebSocket(testClient.fakeWebSocket.serverSideWebsocket as unknown as WebSocket);
    return testClient;
  }

  getFormattedAndFilteredHTML() {
    return formatHTML(
      htmlStringWithFilters(
        (this.doc as any).loadedState.networkedDOM.observableDOM.domRunner.getDocument()
          .documentElement.outerHTML,
      ),
    );
  }
}
