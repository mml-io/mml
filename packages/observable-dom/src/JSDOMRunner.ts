import vm from "vm";

import { LogMessage, RemoteEvent } from "@mml-io/observable-dom-common";
import {
  AbortablePromise,
  DOMWindow,
  FetchOptions,
  JSDOM,
  ResourceLoader,
  ResourceLoaderConstructorOptions,
  VirtualConsole,
} from "jsdom";
import * as nodeFetch from "node-fetch";
import nodeFetchFn from "node-fetch";

import { DOMRunnerFactory, DOMRunnerInterface, DOMRunnerMessage } from "./ObservableDOM";

const ErrDOMWindowNotInitialized = "DOMWindow not initialized";

export const JSDOMRunnerFactory: DOMRunnerFactory = (
  htmlPath: string,
  htmlContents: string,
  params: object,
  callback: (mutationList: DOMRunnerMessage) => void,
): DOMRunnerInterface => {
  return new JSDOMRunner(htmlPath, htmlContents, params, callback);
};

// This is used to stop JSDOM trying to load resources
class RejectionResourceLoader extends ResourceLoader {
  public fetch(url: string): AbortablePromise<Buffer> | null {
    console.error("RejectionResourceLoader.fetch", url);
    return null;
  }
}

export type ResourceURL = string | RegExp;

// This allows JSDOM to load resources if their URLs are specified in the urls array.
class AllowListResourceLoader extends ResourceLoader {
  private urls: ResourceURL[];

  constructor(urls: ResourceURL[], opts?: ResourceLoaderConstructorOptions) {
    super(opts);
    this.urls = urls;
  }
  public fetch(url: string, opts?: FetchOptions): AbortablePromise<Buffer> | null {
    const allow = this.urls.some((allowedURL) => {
      return typeof allowedURL === "string" ? allowedURL === url : allowedURL.test(url);
    });

    if (allow) {
      return super.fetch(url, opts ?? {});
    }

    console.error("AllowListResourceLoader.fetch: resource not allowed", url);
    return null;
  }
}

export type JSDOMRunnerOptions = {
  allowResourceLoading: boolean | ResourceURL[];
};

/**
 * The JSDOMRunner class is used to run HTML Documents using JSDOM and emit DOMRunnerMessages for document events such
 * as mutations.
 *
 * It handles the receiving of remote events and the dispatching of them to the underlying DOM elements.
 */
export class JSDOMRunner implements DOMRunnerInterface {
  public domWindow: DOMWindow | null = null;
  private jsdom: JSDOM;

  private callback: (message: DOMRunnerMessage) => void;
  private mutationObserver: MutationObserver | null = null;
  private htmlPath: string;

  private documentStartTime = Date.now();

  private isLoaded = false;
  private logBuffer: LogMessage[] = [];

  constructor(
    htmlPath: string,
    htmlContents: string,
    params: object,
    callback: (domRunnerMessage: DOMRunnerMessage) => void,
    { allowResourceLoading }: JSDOMRunnerOptions = { allowResourceLoading: false },
  ) {
    this.htmlPath = htmlPath;
    this.callback = callback;

    const resources = Array.isArray(allowResourceLoading)
      ? new AllowListResourceLoader(allowResourceLoading)
      : allowResourceLoading
        ? "usable"
        : new RejectionResourceLoader();

    this.jsdom = new JSDOM(htmlContents, {
      runScripts: "dangerously",
      resources,
      url: this.htmlPath,
      virtualConsole: this.createVirtualConsole(),
      beforeParse: (window) => {
        this.domWindow = window;

        this.domWindow.fetch = nodeFetchFn as unknown as typeof fetch;
        this.domWindow.Headers = nodeFetch.Headers as unknown as typeof Headers;
        this.domWindow.Request = nodeFetch.Request as unknown as typeof Request;
        this.domWindow.Response = nodeFetch.Response as unknown as typeof Response;

        // This is a polyfill for https://developer.mozilla.org/en-US/docs/Web/API/Document/timeline
        const timeline = {};
        Object.defineProperty(timeline, "currentTime", {
          get: () => {
            return this.getDocumentTime();
          },
        });
        (window.document as any).timeline = timeline;

        // JSON stringify and parse to avoid potential reference leaks from the params object
        window.params = JSON.parse(JSON.stringify(params));

        this.mutationObserver = new window.MutationObserver((mutationList) => {
          this.callback({
            mutationList,
          });
        });

        window.addEventListener("load", () => {
          this.mutationObserver?.observe(window.document, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
          });

          this.isLoaded = true;

          this.callback({
            loaded: true,
          });

          this.flushLogBuffer();
        });
      },
    });
  }

  private flushLogBuffer() {
    for (const logMessage of this.logBuffer) {
      this.callback({
        logMessage,
      });
    }

    this.logBuffer = [];
  }

  private log(message: LogMessage) {
    if (!this.isLoaded) {
      this.logBuffer.push(message);
      return;
    }

    this.callback({
      logMessage: message,
    });
  }

  public getDocument(): Document {
    if (!this.domWindow) {
      throw new Error(ErrDOMWindowNotInitialized);
    }

    return this.domWindow.document;
  }

  public getWindow(): any {
    return this.domWindow;
  }

  public dispose() {
    const records = this.mutationObserver?.takeRecords();
    this.callback({
      mutationList: records,
    });
    this.mutationObserver?.disconnect();
    this.jsdom.window.close();
  }

  public getDocumentTime() {
    return Date.now() - this.documentStartTime;
  }

  public dispatchRemoteEventFromConnectionId(
    connectionId: number,
    domNode: Element,
    remoteEvent: RemoteEvent,
  ) {
    if (!this.domWindow) {
      throw new Error(ErrDOMWindowNotInitialized);
    }

    const bubbles = remoteEvent.bubbles || false;
    const remoteEventObject = new this.domWindow.CustomEvent(remoteEvent.name, {
      bubbles,
      detail: { ...remoteEvent.params, connectionId },
    });

    const eventTypeLowerCase = remoteEvent.name.toLowerCase();

    // TODO - check if there are other events that automatically wire up similarly to click->onclick and avoid those too
    if (eventTypeLowerCase !== "click") {
      const handlerAttributeName = "on" + eventTypeLowerCase;
      const handlerAttributeValue = domNode.getAttribute(handlerAttributeName);
      if (handlerAttributeValue) {
        // This event is defined as an HTML event attribute.
        const script = handlerAttributeValue;
        const vmContext = this.jsdom.getInternalVMContext();
        try {
          const invoke = vm.runInContext(`(function(event){ ${script} })`, vmContext);
          Reflect.apply(invoke, domNode, [remoteEventObject]);
        } catch (e) {
          console.error("Error running event handler:", e);
        }
      }
    }

    // Dispatch the event via JavaScript.
    domNode.dispatchEvent(remoteEventObject);
  }

  private createVirtualConsole(): VirtualConsole {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (...args) => {
      this.log({
        level: "system",
        content: args,
      });
    });
    virtualConsole.on("error", (...args) => {
      this.log({
        level: "error",
        content: args,
      });
    });
    virtualConsole.on("warn", (...args) => {
      this.log({
        level: "warn",
        content: args,
      });
    });
    virtualConsole.on("log", (...args) => {
      this.log({
        level: "log",
        content: args,
      });
    });
    virtualConsole.on("info", (...args) => {
      this.log({
        level: "info",
        content: args,
      });
    });
    return virtualConsole;
  }
}
