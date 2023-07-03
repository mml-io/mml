import {
  FromObservableDOMInstanceMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import runnerText from "runner-iframe-js-text";

export class RunnerIframe {
  private iframe: HTMLIFrameElement;
  private onMessageCallback: (message: FromObservableDOMInstanceMessage) => void;
  private postMessageListener: (messageEvent: MessageEvent) => void;

  constructor(
    observableDOMParameters: ObservableDOMParameters,
    onMessageCallback: (message: FromObservableDOMInstanceMessage) => void,
  ) {
    this.iframe = document.createElement("iframe");
    this.iframe.setAttribute("sandbox", "allow-scripts");
    this.iframe.style.position = "fixed";
    this.iframe.style.top = "0";
    this.iframe.style.left = "0";
    this.iframe.style.width = "0";
    this.iframe.style.height = "0";
    this.iframe.style.border = "none";

    const paramsMinusCode: Partial<ObservableDOMParameters> = {
      ...observableDOMParameters,
    };
    delete paramsMinusCode.htmlContents;

    const args = btoa(JSON.stringify(paramsMinusCode));

    const isJSDOM = navigator.userAgent.includes("jsdom");
    if (isJSDOM) {
      // srcdoc not supported, so we have to append elements to the iframe's document
      document.body.append(this.iframe);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const iframeBody = this.iframe.contentWindow!.document.body;
      const argsScriptElement = document.createElement("script");
      argsScriptElement.innerHTML = `window.args="${args}";`;
      iframeBody.append(argsScriptElement);
      const runnerScriptElement = document.createElement("script");
      runnerScriptElement.innerHTML = runnerText;
      iframeBody.append(runnerScriptElement);
      const contentHolder = document.createElement("div");
      iframeBody.append(contentHolder);
      contentHolder.innerHTML = observableDOMParameters.htmlContents;
    } else {
      this.iframe.setAttribute(
        "srcdoc",
        `
      <script>window.args="${args}";</script>
      <script>${runnerText}</script>
      ${observableDOMParameters.htmlContents}
      `,
      );
      document.body.append(this.iframe);
    }

    this.onMessageCallback = onMessageCallback;

    this.postMessageListener = (e: MessageEvent) => {
      if (e.source === this.iframe.contentWindow || (isJSDOM && e.source === null)) {
        const parsed = JSON.parse(e.data) as FromObservableDOMInstanceMessage;
        onMessageCallback(parsed);
      }
    };
    window.addEventListener("message", this.postMessageListener);
  }

  sendMessageToRunner(message: ToObservableDOMInstanceMessage) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.iframe.contentWindow!.postMessage(JSON.stringify(message), "*");
  }

  dispose() {
    window.removeEventListener("message", this.postMessageListener);
    this.iframe.remove();
  }
}
