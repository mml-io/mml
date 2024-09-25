import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-three-client";
import { IframeWrapper, MMLScene, registerCustomElementsToWindow } from "mml-web";
import {
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  MMLWebRunnerClient,
  NetworkedDOM,
} from "mml-web-runner";

const startingContent = `
<m-plane color="blue" width="20" height="20" rx="-90"></m-plane>
<m-light type="spotlight" intensity="900" ry="45" rx="65" rz="-45" x="10" y="10" z="10"></m-light>
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
  iframeBody: HTMLElement,
  networkedDOMDocument: NetworkedDOM | EditableNetworkedDOM,
) {
  const wrapperElement = document.createElement("div");
  wrapperElement.style.position = "relative";
  wrapperElement.style.width = "400px";
  wrapperElement.style.height = "400px";
  wrapperElement.style.border = "1px solid black";
  wrapperElement.style.flexShrink = "0";
  wrapperElement.style.flexGrow = "0";

  const mmlScene = new MMLScene(wrapperElement);
  const client = new MMLWebRunnerClient(windowTarget, iframeBody, mmlScene);
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

  StandaloneThreeJSAdapter.create(wrapperElement, {
    controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
  }).then((graphicsAdapter) => {
    mmlScene.init(graphicsAdapter);
    client.connect(networkedDOMDocument);
  });
  return client;
}

window.addEventListener("DOMContentLoaded", async () => {
  const { iframeWindow, iframeBody } = await IframeWrapper.create();
  registerCustomElementsToWindow(iframeWindow);
  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    true,
  );

  const title = document.createElement("h1");
  title.textContent = "MML Web Runner Example";
  document.body.append(title);

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
    createCloseableClient(clientsHolder, iframeWindow, iframeBody, networkedDOMDocument);
  });
  document.body.append(addButton);

  const clientsHolder = document.createElement("div");
  clientsHolder.style.display = "flex";
  document.body.append(clientsHolder);

  createCloseableClient(clientsHolder, iframeWindow, iframeBody, networkedDOMDocument);
  networkedDOMDocument.load(textArea.value);
});
