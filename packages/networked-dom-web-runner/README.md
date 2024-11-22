# Networked DOM Web Runner
#### `@mml-io/networked-dom-web-runner`

[![npm version](https://img.shields.io/npm/v/@mml-io/networked-dom-web-runner.svg?style=flat)](https://www.npmjs.com/package/@mml-io/networked-dom-web-runner)

This package contains classes that provide a simple way to run a `NetworkedDOM | EditableNetworkedDOM` instance in a browser and synchronise it to one or more local client holder elements.

This functionality allows running NetworkedDOM directly in a browser as if it were on a server from the local client's perspective.

You can connect multiple `NetworkedDOMWebRunnerClient`s to the same `NetworkedDOM | EditableNetworkedDOM` instance and they will all see the same content.

## Example Usage

```typescript
import {
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  NetworkedDOMWebRunnerClient,
} from "@mml-io/networked-dom-web-runner";

window.addEventListener("DOMContentLoaded", () => {
  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    false,
  );

  const clientElement = document.createElement("div");
  clientElement.style.position = "relative";
  clientElement.style.width = "400px";
  clientElement.style.height = "400px";
  clientElement.style.backgroundColor = "gray";
  const client = new NetworkedDOMWebRunnerClient();
  document.body.append(client.element);
  client.connect(networkedDOMDocument);

  networkedDOMDocument.load(`
<div id="my-div" style="width:50px; height: 50px; background-color:orange; color: white;">Init</div>
<button id="my-button">Click me!</button>
<script>
  const myDiv = document.getElementById("my-div");
  const myButton = document.getElementById("my-button");

  let colorToggle = false;
  myButton.addEventListener("click", () => {
    colorToggle = !colorToggle;
    myDiv.style.backgroundColor = (colorToggle ? "green" : "red");
  });

  let textToggle = false;
  setInterval(() => {
    textToggle = !textToggle;
    myDiv.textContent = textToggle ? "Hello" : "World";
  }, 1000);
</script>`);
});
```
