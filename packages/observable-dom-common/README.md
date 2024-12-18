# Observable DOM Common
#### `@mml-io/observable-dom-common`

[![npm version](https://img.shields.io/npm/v/@mml-io/observable-dom-common.svg?style=flat)](https://www.npmjs.com/package/@mml-io/observable-dom-common)

This package contains the interface types and messages used by the Observable DOM system and some helper functions for bridging messages and interfaces.

## Classes

* `ObservableDOMInterface`
  * The interface of an `ObservableDOM`.
* `observableDOMInterfaceToMessageSender`
  * A function that returns an object that matches the `ObservableDOMInterface`, but sends messages corresponding to interactions with the interface to a provided callback.
* `applyMessageToObservableDOMInstance`
  * A function that applies a message (from `observableDOMInterfaceToMessageSender`) to an `ObservableDOM` instance.
* `ToObservableDOMInstanceMessage` and `FromObservableDOMInstanceMessage`
  * Messages that can describe the emissions and interactions with an ObservableDOM instance.
