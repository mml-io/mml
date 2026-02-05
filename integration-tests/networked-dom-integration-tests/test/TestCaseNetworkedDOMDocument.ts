import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import { LogMessage } from "@mml-io/observable-dom-common";

import { formatHTML, htmlStringWithFilters } from "./test-util";
import { TestCaseNetworkedDOMClient } from "./TestCaseNetworkedDOMClient";

export class TestCaseNetworkedDOMDocument {
  public doc: EditableNetworkedDOM;
  private clients: TestCaseNetworkedDOMClient[] = [];

  constructor(ignoreTextNodes = true) {
    this.doc = new EditableNetworkedDOM(
      "http://localhost/test-case-document",
      LocalObservableDOMFactory,
      ignoreTextNodes,
      (logMessage: LogMessage) => {
        console.log(`[NetworkedDOM Document] ${logMessage.level}: ${logMessage.content}`);
      },
    );
  }

  createClient(useV01 = false) {
    const testClient = new TestCaseNetworkedDOMClient(useV01);
    this.doc.addWebSocket(testClient.fakeWebSocket.serverSideWebsocket as unknown as WebSocket);
    this.clients.push(testClient);
    return testClient;
  }

  dispose() {
    for (const client of this.clients) {
      client.dispose();
    }
    this.clients = [];
    this.doc.dispose();
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
