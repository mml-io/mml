# Networked DOM Web Client

This package contains a basic standalone client as a single JavaScript bundle that can be included in the source of a webpage to connect to a `NetworkedDOM` document over a WebSocket and present it on the page.

# Usage

The query parameters of the `<script/>` tag that the script is included with can be used to configure a remote address of a document to load into the page.

## Example Usage
E.g. 

```html
<script src="/path/to/this/package/build/index.js?url=wss://example.com/some-networked-dom-websocket"></script>
```
