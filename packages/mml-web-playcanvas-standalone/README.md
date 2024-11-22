# MML Web PlayCanvas Standalone
#### `@mml-io/mml-web-playcanvas-standalone`

[![npm version](https://img.shields.io/npm/v/@mml-io/mml-web-playcanvas-standalone.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-web-playcanvas-standalone)

This package contains a class, `StandalonePlayCanvasAdapter`, that is a PlayCanvas-backed Graphics Adapter implementation for `@mml-io/mml-web` that creates:
* A PlayCanvas App instance
  * with embedded DRACO, Ammo, glglang, and twgsl WASM bundles as base64 encoded strings (to avoid external dependencies at runtime)
* Orbit and drag-fly controls
* A factory for MML element graphics instances from the `@mml-io/mml-web-playcanvas` package.

It is intended to be used with the following packages:
* `@mml-io/mml-web`
  * provides the MML element handling and parsing and can use this package as a Graphics Adapter.


## Example Usage

```typescript
import { FullScreenMMLScene } from "@mml-io/mml-web";
import {
  StandalonePlayCanvasAdapter, StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-standalone";

// ** This code is not a complete example. See @mml-io/mml-web for more info on how to use an MMLScene **

// Create an MML Scene that will act as the container for MML content
const fullScreenMMLScene = new FullScreenMMLScene<StandalonePlayCanvasAdapter>();
// Append the element of the MML scene to the page
document.body.append(fullScreenMMLScene.element);

// Provide the element for the renderer to the adapter to attach controls to
const graphicsAdapter = await StandalonePlayCanvasAdapter.create(fullScreenMMLScene.element, {
  controlsType: StandalonePlayCanvasAdapterControlsType.DragFly,
});

// Provide the Graphics Adapter to the MML Scene to use to render elements
fullScreenMMLScene.init(graphicsAdapter);
```
