import { JSDOMRunnerFactory, ObservableDom } from "@mml-io/observable-dom";
import {
  ObservableDomInterface,
  ObservableDomMessage,
  ObservableDOMParameters,
} from "@mml-io/observable-dom-common";

export function LocalObservableDomFactory(
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDomMessage) => void,
): ObservableDomInterface {
  return new ObservableDom(observableDOMParameters, callback, JSDOMRunnerFactory);
}

export * from "@mml-io/observable-dom";
export * from "@mml-io/networked-dom-document";
