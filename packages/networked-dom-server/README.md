# Networked DOM Server
#### `@mml-io/networked-dom-server`

[![npm version](https://img.shields.io/npm/v/@mml-io/networked-dom-server.svg?style=flat)](https://www.npmjs.com/package/@mml-io/networked-dom-server)

This package is a wrapper around multiple packages and adds an additional function to combine them:
* `@mml-io/observable-dom`
  * `ObservableDOM`
    * class that takes a `DOMRunnerFactory` and runs a DOM from a string which emits events when the DOM updates and can apply events to the DOM.
  * `JSDOMRunner`
    * a JSDOM-backed implementation of the `DOMRunnerInterface` (a way to run a DOM from a string and interact with it).
  * `JSDOMRunnerFactory`
    * a `DOMRunnerFactory` factory that creates `JSDOMRunner` instances.
* `@mml-io/networked-dom-document`
  * `NetworkedDOM` and `EditableNetworkedDOM`
    * Takes an `ObservableDOMFactory` to create an `ObservableDOM` instance containing the document.
    * Handle WebSocket connections to NetworkedDOM documents.
* `LocalObservableDOMFactory`
  * An implementation of `ObservableDOMFactory` that creates `ObservableDOM` instances with a `JSDOMRunner`.
