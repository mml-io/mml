import { JSDOMRunner, ObservableDOM } from "@mml-io/observable-dom";
import type {
  ObservableDOMInterface,
  ObservableDOMMessage,
  ObservableDOMParameters,
} from "@mml-io/observable-dom-common";

/**
 * Creates an ObservableDOMFactory that passes globals to the JSDOMRunner
 */
export function createObservableDOMFactoryWithGlobals(
  globals: Record<string, any>,
): (
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
) => ObservableDOMInterface {
  return (observableDOMParameters, callback) => {
    return new ObservableDOM(
      observableDOMParameters,
      callback,
      (htmlPath, htmlContents, params, callback) => {
        return new JSDOMRunner(htmlPath, htmlContents, params, callback, { globals });
      },
    );
  };
}
