import {
  EditableNetworkedDOM,
  FakeWebsocket,
  IframeObservableDOMFactory,
  NetworkedDOM,
  NetworkedDOMWebRunnerClient,
} from "@mml-io/networked-dom-web-runner";
import {
  FromBroadcastInstanceMessage,
  NetworkedDOMBroadcastReceiver,
  NetworkedDOMBroadcastRunner,
  ToBroadcastInstanceMessage,
} from "@mml-io/networked-dom-web-runner-broadcast";
import { LogMessage } from "@mml-io/observable-dom-common";

const startingContent = `
<div id="my-div" style="width:50px; height: 50px; background-color:orange; color: white;">Init</div>
<div id="connected-status-div" style="background-color:blue; color: white;">Connected: 0</div>
<button id="my-button">Click me!</button>
<script>
  const myDiv = document.getElementById("my-div");
  const myButton = document.getElementById("my-button");
  const connectedStatusDiv = document.getElementById("connected-status-div");
  let connectedCount = 0;

  let colorToggle = false;
  myButton.addEventListener("click", () => {
    colorToggle = !colorToggle;
    myDiv.style.backgroundColor = (colorToggle ? "green" : "red");
  });

  let textToggle = false;
  setInterval(() => {
    textToggle = !textToggle;
    myDiv.textContent = textToggle ? "Hello" : "World";
  }, 1000);
  
  window.addEventListener("connected", () => {
    connectedCount++;
    connectedStatusDiv.textContent = "Connected: "+connectedCount;
  });
  window.addEventListener("disconnected", () => {
    connectedCount--;
    connectedStatusDiv.textContent = "Connected: "+connectedCount;
  });
</script>`;

function createCloseableNetworkedDOMWebRunnerClient(
  clientsHolder: HTMLElement,
  networkedDOMDocument: NetworkedDOM | EditableNetworkedDOM,
) {
  const wrapperElement = document.createElement("div");
  wrapperElement.style.position = "relative";
  wrapperElement.style.width = "400px";
  wrapperElement.style.height = "400px";
  wrapperElement.style.border = "1px solid black";
  wrapperElement.style.flexShrink = "0";
  wrapperElement.style.flexGrow = "0";
  const client = new NetworkedDOMWebRunnerClient();
  wrapperElement.append(client.element);
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.position = "absolute";
  closeButton.style.bottom = "0";
  closeButton.style.right = "0";
  closeButton.addEventListener("click", () => {
    client.dispose();
    closeButton.remove();
    wrapperElement.remove();
  });
  wrapperElement.append(closeButton);
  clientsHolder.append(wrapperElement);
  client.connect(networkedDOMDocument);
  return client;
}

const fakeWebSocket = new FakeWebsocket("");

const broadcastReceiver = new NetworkedDOMBroadcastReceiver(
  (toBroadcastInstanceMessage: ToBroadcastInstanceMessage) => {
    fakeWebSocket.serverSideWebsocket.send(JSON.stringify(toBroadcastInstanceMessage));
  },
  true,
  (logMessage: LogMessage) => {
    console.log(logMessage);
  },
);

fakeWebSocket.serverSideWebsocket.addEventListener("message", (message: MessageEvent) => {
  broadcastReceiver.handleMessage(JSON.parse(message.data) as FromBroadcastInstanceMessage);
});

const broadcastRunner = new NetworkedDOMBroadcastRunner(
  (fromBroadcastInstanceMessage: FromBroadcastInstanceMessage) => {
    fakeWebSocket.clientSideWebsocket.send(JSON.stringify(fromBroadcastInstanceMessage));
  },
  IframeObservableDOMFactory,
);

fakeWebSocket.clientSideWebsocket.addEventListener("message", (message: MessageEvent) => {
  broadcastRunner.handleMessage(JSON.parse(message.data) as ToBroadcastInstanceMessage);
});

window.addEventListener("DOMContentLoaded", () => {
  const title = document.createElement("h1");
  title.textContent = "Networked DOM Web Runner Broadcast Example";
  document.body.append(title);

  const textArea = document.createElement("textarea");
  textArea.style.width = "500px";
  textArea.style.height = "500px";
  textArea.value = startingContent;
  textArea.addEventListener("input", () => {
    broadcastRunner.load({
      htmlContents: textArea.value,
      htmlPath: "file://test.html",
      ignoreTextNodes: false,
      params: {},
    });
  });
  document.body.append(textArea);
  const addButton = document.createElement("button");
  addButton.textContent = "Add client";
  addButton.addEventListener("click", () => {
    createCloseableNetworkedDOMWebRunnerClient(
      clientsHolder,
      broadcastReceiver.editableNetworkedDOM,
    );
  });
  document.body.append(addButton);

  const clientsHolder = document.createElement("div");
  clientsHolder.style.display = "flex";
  document.body.append(clientsHolder);

  createCloseableNetworkedDOMWebRunnerClient(clientsHolder, broadcastReceiver.editableNetworkedDOM);

  broadcastRunner.load({
    htmlContents: textArea.value,
    htmlPath: "file://test.html",
    ignoreTextNodes: false,
    params: {},
  });
});
