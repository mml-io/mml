import { JSDOMRunnerFactory, ObservableDOM } from "@mml-io/observable-dom";
import {
  ObservableDOMInterface,
  ObservableDOMMessage,
  ObservableDOMParameters,
} from "@mml-io/observable-dom-common";

export function LocalObservableDOMFactory(
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
): ObservableDOMInterface {
  return new ObservableDOM(observableDOMParameters, callback, JSDOMRunnerFactory);
}

export * from "@mml-io/observable-dom";
export * from "@mml-io/networked-dom-document";
