# MML Web Client

This package contains a basic standalone client as a single JavaScript bundle that can be included in the source of a webpage to render MML documents.

### Note
This bundle is currently quite heavy as it includes both the THREE.js and PlayCanvas renderers. 


# Usage

The query parameters of the `<script/>` tag that the script is included with can be used to configure a remote address of a document to load into the page; otherwise the client configures the main window as the source of content and any tags on the page are used as the content.

## Example Usage for a Remote Document
E.g. 

```html
<script src="/path/to/this/package/build/index.js?url=https://public.mml.io/rgb-cubes.html"></script>
```

## Example Usage for Inline Content

```html
<script src="/path/to/this/package/build/index.js"></script>
<m-group>
  <m-cube x="1" color="red"></m-cube>
  <m-cube x="2" color="green"></m-cube>
  <m-cube x="3" color="blue"></m-cube>
</m-group>
```

