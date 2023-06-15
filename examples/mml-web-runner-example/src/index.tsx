import { IframeWrapper, registerCustomElementsToWindow } from "mml-web";
import {
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  MMLWebRunnerClient,
  NetworkedDOM,
} from "mml-web-runner";

const startingContent = `
<m-plane color="blue" width="20" height="20" rx="-90"></m-plane>
<m-light type="spotlight" ry="45" rx="65" rz="-45" x="10" y="10" z="10"></m-light>
<m-cube y="2" id="my-cube" color="red"></m-cube>
<m-cube x="2" y="2" color="orange" visible-to="1"></m-cube>

<script>
  let toggle = false;
  const myCube = document.getElementById("my-cube");
  if (window.params.color) {
    myCube.setAttribute("color", window.params.color);
  }
  myCube.addEventListener("click", () => {
    toggle = !toggle;
    myCube.setAttribute("color", toggle ? "green" : "red");
  });
  setInterval(() => {
    myCube.setAttribute("ry", new Date().getTime() / 50);
  }, 500);
</script>
`;

function createCloseableClient(
  clientsHolder: HTMLElement,
  windowTarget: Window,
  remoteHolderElement: HTMLElement,
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
  const client = new MMLWebRunnerClient(windowTarget, remoteHolderElement);
  wrapperElement.append(client.element);
  clientsHolder.append(wrapperElement);
  client.connect(networkedDOMDocument);
  return client;
}

window.addEventListener("DOMContentLoaded", () => {
  const iframeRemoteSceneWrapper = new IframeWrapper();
  document.body.append(iframeRemoteSceneWrapper.iframe);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const windowTarget = iframeRemoteSceneWrapper.iframe.contentWindow!;
  registerCustomElementsToWindow(windowTarget);

  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    true,
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
    createCloseableClient(clientsHolder, windowTarget, remoteHolderElement, networkedDOMDocument);
  });
  document.body.append(addButton);

  const clientsHolder = document.createElement("div");
  clientsHolder.style.display = "flex";
  document.body.append(clientsHolder);

  const remoteHolderElement = windowTarget.document.body;

  createCloseableClient(clientsHolder, windowTarget, remoteHolderElement, networkedDOMDocument);

  networkedDOMDocument.load(textArea.value);
});
