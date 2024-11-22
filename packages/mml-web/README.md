# MML Web
#### `@mml-io/mml-web`

[![npm version](https://img.shields.io/npm/v/@mml-io/mml-web.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-web)

This package contains a library for interpreting HTML elements and attribute on a webpage as MML.

It supports
* connecting to websocket Networked DOM documents (i.e. `wss://`) server using the `@mml-io/networked-dom-web` package.
* fetching static content (i.e. `https://`).

The library handles parsing the attributes and the interaction of elements with each other such as `m-attr-anim` affecting the attributes of other elements.

This internal representation of the MML document can then be rendered to the screen using a *Graphics Adapter*. Graphics Adapters are provided as separate packages due to the dependencies on external libraries such as ThreeJS and PlayCanvas.

The library is instantiated with a Graphics Adapter as a way to expose the element states to a renderer (e.g. ThreeJS or PlayCanvas).

The following Graphics Adapters are available:
* `@mml-io/mml-web-threejs`
  * A Graphics Adapter for ThreeJS that allows attaching MML elements to a ThreeJS scene.
* `@mml-io/mml-web-threejs-standalone`
  * A standalone ThreeJS client for rendering MML elements.
* `@mml-io/mml-web-playcanvas`
  * A Graphics Adapter for PlayCanvas that allows attaching MML elements to a PlayCanvas app.
* `@mml-io/mml-web-playcanvas-standalone`
  * A standalone PlayCanvas client for rendering MML elements.
* `StandaloneTagDebugAdapter` in this package.
  * A standalone Graphics Adapter that renders MML elements as HTML tags in a code view.

## Usage

```typescript
import {
  FullScreenMMLScene,
  IframeWrapper,
  MMLNetworkSource,
  NetworkedDOMWebsocketStatus,
  registerCustomElementsToWindow,
} from "@mml-io/mml-web";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

async function createFullScreenThreeJSMML(url: string) {
  // Create an iframe to hold the elements from the MML document
  const { iframeWindow, iframeBody } = await IframeWrapper.create();
  const windowTarget = iframeWindow;
  const targetForWrappers = iframeBody;

  // Register the implementations of custom elements (e.g. m-cube) to the iframe window
  registerCustomElementsToWindow(iframeWindow);

  // Create a full-screen MML scene
  const mmlScene = new FullScreenMMLScene<StandaloneThreeJSAdapter>();
  document.body.append(mmlScene.element);

  // Create a standalone ThreeJS adapter with drag-fly controls
  const graphicsAdapter = await StandaloneThreeJSAdapter.create(mmlScene.element, {
    controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
  });

  // Initialize the MML scene with the graphics adapter
  mmlScene.init(graphicsAdapter);

  /*
   Create a network source for the MML document which will:
   - Create a holder in the iframe for the elements from the MML document
   - Configure the MML scene to display the elements from the holder
   - Connect to the document from the specified address and load the elements into the holder
  */
  MMLNetworkSource.create({
    url,
    mmlScene,
    windowTarget,
    targetForWrappers,
    statusUpdated: (status: NetworkedDOMWebsocketStatus) => {
      console.log("Status updated", status);
    },
  });
}
```
