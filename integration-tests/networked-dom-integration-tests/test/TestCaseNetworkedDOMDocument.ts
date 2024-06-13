import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { LocalObservableDOMFactory } from "networked-dom-server";

import { formatHTML, htmlStringWithFilters } from "./test-util";
import { TestCaseNetworkedDOMClient } from "./TestCaseNetworkedDOMClient";

export class TestCaseNetworkedDOMDocument {
  public doc: EditableNetworkedDOM;

  constructor() {
    this.doc = new EditableNetworkedDOM("file://test.html", LocalObservableDOMFactory);
  }

  createClient() {
    const testClient = new TestCaseNetworkedDOMClient();
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
