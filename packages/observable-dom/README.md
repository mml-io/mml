# Observable DOM
#### `@mml-io/observable-dom`

[![npm version](https://img.shields.io/npm/v/@mml-io/observable-dom.svg?style=flat)](https://www.npmjs.com/package/@mml-io/observable-dom)

This package is the core of the NetworkedDOM system. It provides classes that can execute HTML documents (including JavaScript) and emit messages that describe the changes to the DOM.

It is designed to be used in a message-passing system, where the messages are sent to a remote client that can apply the changes to a local DOM to keep it in sync with the remote DOM.

It is also capable of diffing the changes between the last state of a DOM and a current/new state of a DOM, and describing only necessary changes to make to reach the new state.

## Classes

* `ObservableDOM`
  * A class that can execute HTML documents using a provided `DOMRunnerInterface` / `DOMRunnerFactory` and emit messages that describe the changes to the DOM.
  * Can apply events to the DOM.
* `JSDOMRunner` / `JSDOMRunnerFactory`
  * A class that implements the `DOMRunnerInterface` / `DOMRunnerFactory` and uses `jsdom` to execute HTML documents.
