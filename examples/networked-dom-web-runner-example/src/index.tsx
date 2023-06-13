import {
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  NetworkedDOM,
  NetworkedDOMWebRunnerClient,
} from "@mml-io/networked-dom-web-runner";

const startingContent = `<div id="my-div" style="width:50px; height: 50px; background-color:orange;">Init</div>
<button id="my-button">Click me!</button>
<script>
  const myDiv = document.getElementById("my-div");
  const myButton = document.getElementById("my-button");

  let colorToggle = false;
  myButton.addEventListener("click", () => {
    colorToggle = !colorToggle;
    myDiv.setAttribute(
      "style",
      "background-color: "+(colorToggle ? "green" : "red")+"; width: 50px; height: 50px;",
    );
  });

  let textToggle = false;
  setInterval(() => {
    textToggle = !textToggle;
    myDiv.textContent = textToggle ? "Hello" : "World";
  }, 1000);
</script>`;

function createCloseableNetworkedDOMWebRunnerClient(
  clientsHolder: HTMLElement,
  networkedDOMDocument: NetworkedDOM | EditableNetworkedDOM,
) {
  const wrapperElement = document.createElement("div");
  wrapperElement.style.position = "relative";
  wrapperElement.style.width = "400px";
  wrapperElement.style.height = "400px";
  wrapperElement.style.flexShrink = "0";
  wrapperElement.style.flexGrow = "0";
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => {
    client.dispose();
    closeButton.remove();
    wrapperElement.remove();
  });
  wrapperElement.append(closeButton);
  const client = new NetworkedDOMWebRunnerClient();
  wrapperElement.append(client.element);
  clientsHolder.append(wrapperElement);
  client.connect(networkedDOMDocument);
  return client;
}

window.addEventListener("DOMContentLoaded", () => {
  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    false,
  );

  const textArea = document.createElement("textarea");
  textArea.style.width = "500px";
  textArea.style.height = "500px";
  textArea.value = startingContent;
  textArea.addEventListener("input", () => {
    networkedDOMDocument.load(textArea.value);
  });
  document.body.append(textArea);
  const addButton = document.createElement("button");
  addButton.textContent = "Add client";
  addButton.addEventListener("click", () => {
    createCloseableNetworkedDOMWebRunnerClient(clientsHolder, networkedDOMDocument);
  });
  document.body.append(addButton);

  const clientsHolder = document.createElement("div");
  clientsHolder.style.display = "flex";
  document.body.append(clientsHolder);

  createCloseableNetworkedDOMWebRunnerClient(clientsHolder, networkedDOMDocument);

  networkedDOMDocument.load(textArea.value);
});
