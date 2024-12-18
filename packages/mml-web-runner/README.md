# MML Web Runner
#### `@mml-io/mml-web-runner`

[![npm version](https://img.shields.io/npm/v/@mml-io/mml-web-runner.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-web-runner)

This package contains classes that provide a simple way to run a `NetworkedDOM | EditableNetworkedDOM` instance in a browser and connect it directly to an `MMLScene`.

This functionality allows running MML content directly in a browser as if it were on a server from the local client's perspective. 

You can connect multiple `MMLWebRunnerClient`s to the same `NetworkedDOM | EditableNetworkedDOM` instance and they will all see the same content.

It directly exports the exports of the `@mml-io/networked-dom-web-runner` package to simplify the MML-based usage of what is otherwise NetworkedDOM functionality. 

## Example Usage

```typescript
import { IframeWrapper, MMLScene, registerCustomElementsToWindow } from "@mml-io/mml-web";
import {
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  MMLWebRunnerClient,
} from "@mml-io/mml-web-runner";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

window.addEventListener("DOMContentLoaded", async () => {
  // Create an iframe to isolate the MML content from the rest of the page
  const { iframeWindow, iframeBody } = await IframeWrapper.create();

  // Register the MML custom elements to the iframe window
  registerCustomElementsToWindow(iframeWindow);

  // Create a networked DOM document which acts as the "server" for the MML content
  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    true,
  );
  /*
   Load MML content. It can run `<script>` tags and they'll execute in an
   isolated iframe context.

   `load()` can be called multiple times and the clients will be updated.
  */
  networkedDOMDocument.load(`
<m-cube color="red" id="my-cube"></m-cube>
<m-light x="1" y="2" z="3" intensity="50" type="point"></m-light>
`);

  // Create an element to render the MML content
  const clientElement = document.createElement("div");
  clientElement.style.position = "relative";
  clientElement.style.backgroundColor = "gray";
  clientElement.style.width = "400px";
  clientElement.style.height = "400px";
  document.body.append(clientElement);

  // Create an MML scene which will contain the MML content that the client will view
  const mmlScene = new MMLScene(clientElement);

  // Create a client that will connect to the NetworkedDOM document and synchronize it to the MML scene
  const client = new MMLWebRunnerClient(iframeWindow, iframeBody, mmlScene);

  // Create a graphics adapter that will render the MML content from the MMLScene using ThreeJS
  const graphicsAdapter = await StandaloneThreeJSAdapter.create(clientElement, {
    controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
  });
  // Initialize the MML scene with the graphics adapter
  mmlScene.init(graphicsAdapter);

  // Connect the client to the NetworkedDOM document to get the MML content
  client.connect(networkedDOMDocument);
});
```
