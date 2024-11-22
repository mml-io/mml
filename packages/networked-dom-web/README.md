# Networked DOM Web
#### `@mml-io/networked-dom-web`

[![npm version](https://img.shields.io/npm/v/@mml-io/networked-dom-web.svg?style=flat)](https://www.npmjs.com/package/@mml-io/networked-dom-web)

This package contains the `NetworkedDOMWebsocket` class which can connect to a WebSocket server using the `networked-dom-v0.1` protocol and interact with a `NetworkedDOM` document.

## Example Usage 

```typescript
// Create an element to contain the remote document's elements
const targetElement = document.createElement("div");

const networkedDOMWebsocket = new NetworkedDOMWebsocket(
  "wss://example.com/some-networked-dom-websocket",
  NetworkedDOMWebsocket.createWebSocket, // Use the default websocket creator function
  targetElement,
  (time: number) => {
    // The time of the remote document has updated
  },
  (status: NetworkedDOMWebsocketStatus) => {
    // Handle status changes
  },
  { // Optional configuration
    tagPrefix: "m-",// Limit which elements can be created
    replacementTagPrefix: "mml-", // If elements do not have the tagPrefix, prepend this prefix
  },
);

// Events for elements from the remote document can be sent to the remote document
function sendEventToRemoteDocument(element: HTMLElement, event: CustomEvent<{ element: HTMLElement }>) {
  networkedDOMWebsocket.handleEvent(element, event);
}
```
