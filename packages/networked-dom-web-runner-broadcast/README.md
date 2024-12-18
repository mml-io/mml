# Networked DOM Web Runner Broadcast
#### `@mml-io/networked-dom-web-runner-broadcast`

[![npm version](https://img.shields.io/npm/v/@mml-io/networked-dom-web-runner-broadcast.svg?style=flat)](https://www.npmjs.com/package/@mml-io/networked-dom-web-runner-broadcast)

This package contains classes that provide a way to cleanly separate the execution of an `ObservableDOM` instance from the client-serving `EditableNetworkedDOM` instance with message-passing between them.

This allows for the `ObservableDOM` to be run in a separate process or on a separate server from the `EditableNetworkedDOM` instance.

## Classes

* `NetworkedDOMBroadcastRunner`
  * A class that can run `ObservableDOM` instances and be reloaded with contents.
  * Emits messages from the execution of the `ObservableDOM` to a provided callback (expected to be sent to a `NetworkedDOMBroadcastReceiver`).
  * Accepts messages from a `NetworkedDOMBroadcastReceiver` and applies them to the `ObservableDOM` instance.
* `NetworkedDOMBroadcastReceiver`
  * A class that handles the messages emit from a `NetworkedDOMBroadcastRunner` and applies them to an `EditableNetworkedDOM` instance (that can accept WebSockets from clients).
  * Emits messages from the handling of the `EditableNetworkedDOM` to a provided callback (expected to be sent to a `NetworkedDOMBroadcastRunner`).
