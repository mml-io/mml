# Networked DOM Web Runner Relay
#### `@mml-io/networked-dom-web-runner-relay`

[![npm version](https://img.shields.io/npm/v/@mml-io/networked-dom-web-runner-relay.svg?style=flat)](https://www.npmjs.com/package/@mml-io/networked-dom-web-runner-relay)

This package contains classes that provide a way to create an `ObservableDOMFactory` that is run by message-passing.

## Classes

* `RemoteNetworkedDOMInstanceClient`
  * A class that has an `ObservableDOMFactory`-compliant interface (can create `ObservableDOM` instances).
  * Emits messages for the management and interactions with the `ObservableDOM` instances to a provided callback (expected to be sent to a `RemoteNetworkedDOMInstanceServer`).
  * Accepts messages from a `RemoteNetworkedDOMInstanceServer` and applies them to the relevant `ObservableDOM` instance.
* `RemoteNetworkedDOMInstanceServer`
  * A class that handles the messages emit from a `RemoteNetworkedDOMInstanceClient` and can run multiple `ObservableDOM` instances.
  * Emits messages from execution of the `ObservableDOM` instances to a provided callback (expected to be sent to a `RemoteNetworkedDOMInstanceClient`).
