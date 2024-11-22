import {
  IframeWrapper,
  MMLScene,
  registerCustomElementsToWindow,
  StandaloneGraphicsAdapter,
  StandaloneTagDebugAdapter,
} from "@mml-io/mml-web";
import {
  StandalonePlayCanvasAdapter,
  StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-standalone";
import {
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  MMLWebRunnerClient,
  NetworkedDOM,
} from "@mml-io/mml-web-runner";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

const startingContent = `
<m-plane color="blue" width="20" height="20" rx="-90"></m-plane>
<m-light type="point" intensity="900" ry="45" rx="65" rz="-45" x="10" y="5" z="10"></m-light>
<m-cube y="2" id="my-cube" color="red"></m-cube>

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
  type: "three" | "playcanvas" | "tags" = "three",
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
  let graphicsAdapter: StandaloneGraphicsAdapter | null = null;
  closeButton.addEventListener("click", () => {
    client.dispose();
    mmlScene.dispose();
    closeButton.remove();
    wrapperElement.remove();
    if (graphicsAdapter) {
      graphicsAdapter.dispose();
    }
  });
  wrapperElement.append(closeButton);
  clientsHolder.append(wrapperElement);

  let graphicsAdapterPromise;
  if (type === "playcanvas") {
    graphicsAdapterPromise = StandalonePlayCanvasAdapter.create(wrapperElement, {
      controlsType: StandalonePlayCanvasAdapterControlsType.DragFly,
    });
  } else if (type === "tags") {
    graphicsAdapterPromise = StandaloneTagDebugAdapter.create(wrapperElement);
  } else {
    graphicsAdapterPromise = StandaloneThreeJSAdapter.create(wrapperElement, {
      controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
    });
  }
  graphicsAdapterPromise.then((createdGraphicsAdapter) => {
    graphicsAdapter = createdGraphicsAdapter;
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
  const addThreeButton = document.createElement("button");
  addThreeButton.textContent = "Add THREE client";
  addThreeButton.addEventListener("click", () => {
    createCloseableClient(clientsHolder, iframeWindow, iframeBody, networkedDOMDocument, "three");
  });
  document.body.append(addThreeButton);

  const addPlayCanvasButton = document.createElement("button");
  addPlayCanvasButton.textContent = "Add PlayCanvas client";
  addPlayCanvasButton.addEventListener("click", () => {
    createCloseableClient(
      clientsHolder,
      iframeWindow,
      iframeBody,
      networkedDOMDocument,
      "playcanvas",
    );
  });
  document.body.append(addPlayCanvasButton);

  const addTagsButton = document.createElement("button");
  addTagsButton.textContent = "Add Tags client";
  addTagsButton.addEventListener("click", () => {
    createCloseableClient(clientsHolder, iframeWindow, iframeBody, networkedDOMDocument, "tags");
  });
  document.body.append(addTagsButton);

  const clientsHolder = document.createElement("div");
  clientsHolder.style.display = "flex";
  document.body.append(clientsHolder);

  createCloseableClient(clientsHolder, iframeWindow, iframeBody, networkedDOMDocument, "three");
  createCloseableClient(
    clientsHolder,
    iframeWindow,
    iframeBody,
    networkedDOMDocument,
    "playcanvas",
  );
  createCloseableClient(
    clientsHolder,
    iframeWindow,
    iframeBody,
    networkedDOMDocument,
    "playcanvas",
  );
  networkedDOMDocument.load(textArea.value);
});
