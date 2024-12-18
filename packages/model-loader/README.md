# MML Model Loader
#### `@mml-io/model-loader`

[![npm version](https://img.shields.io/npm/v/@mml-io/model-loader.svg?style=flat)](https://www.npmjs.com/package/@mml-io/model-loader)

This package contains a class, `ModelLoader`, that provides a way to load gLTF and FBX models for ThreeJS without knowing which format the model is prior to loading.

## Example URL Loading Usage

```typescript
import { ModelLoader } from "@mml-io/model-loader";

const modelLoader = new ModelLoader();
const modelLoadedResult = await modelLoader.load("https://public.mml.io/duck.glb", (loaded, total) => {
    console.log(`Loaded ${loaded} of ${total} bytes`);
});
const { group, animations } = modelLoadedResult;
// Add the model to a scene
scene.add(group);
```

## Example Buffer Loading Usage

```typescript
import { ModelLoader } from "@mml-io/model-loader";

// Populate a buffer with model data from a gLTF or FBX file (e.g. a drag and drop event)
const buffer = new ArrayBuffer([...]);

/*
 pathName is used for any relative asset requests within the model file, but in 
 the case of loading from a buffer it's unlikely you'll have a useful path
*/
const pathName = "duck.glb";

const modelLoader = new ModelLoader();
const modelLoadedResult = await modelLoader.loadFromBuffer(buffer, pathName);
const { group, animations } = modelLoadedResult;
// Add the model to a scene
scene.add(group);
```
