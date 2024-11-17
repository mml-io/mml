# MML Web
#### `@mml-io/mml-web`

[![npm version](https://img.shields.io/npm/v/@mml-io/mml-web.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-web)

This package contains a library for interpreting HTML elements and attribute on a webpage as MML.

It supports
* connecting to websocket Networked DOM documents (i.e. `wss://`) server using the `@mml-io/networked-dom-web` package.
* fetching static content (i.e. `https://`).

The library handles parsing the attributes and the interaction of elements with each other such as `m-attr-anim` affecting the attributes of other elements.

This internal representation of the MML document can then be rendered to the screen using a *Graphics Adapter*. 

The library is instantiated with a Graphics Adapter as a way to expose the element states to a renderer (e.g. ThreeJS or PlayCanvas).

The following Graphics Adapters are available:
* `@mml-io/mml-web-three`
  * A Graphics Adapter for ThreeJS that allows attaching MML elements to a ThreeJS scene.
* `@mml-io/mml-web-three-client`
  * A standalone ThreeJS client for rendering MML elements.
* `@mml-io/mml-web-playcanvas`
  * A Graphics Adapter for PlayCanvas that allows attaching MML elements to a PlayCanvas app.
* `@mml-io/mml-web-playcanvas-client`
  * A standalone PlayCanvas client for rendering MML elements.
* `StandaloneTagDebugAdapter` in this package.
  * A standalone Graphics Adapter that renders MML elements as HTML tags in a code view.

## Usage

```typescript

async function createFullScreenThreeJSMML(documentAddress: string) {
  const element = document.createElement("div");
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.position = "relative";
  document.body.append(element);
  const graphicsAdapter = await StandaloneThreeJSAdapter.create(element, {
    controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
  });
  const scene = new FullScreenMMLScene<StandaloneThreeJSAdapter>(element);
  scene.init(graphicsAdapter);
  const remoteDocument = document.createElement("m-remote-document") as RemoteDocument<
    ThreeJSGraphicsAdapter | PlayCanvasGraphicsAdapter
  >;
  remoteDocument.init(scene, documentAddress);
  document.body.append(remoteDocument);
}
```
