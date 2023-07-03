import vm from "vm";

import { LogMessage, RemoteEvent } from "@mml-io/observable-dom-common";
import { AbortablePromise, DOMWindow, JSDOM, ResourceLoader, VirtualConsole } from "jsdom";
import * as nodeFetch from "node-fetch";
import nodeFetchFn from "node-fetch";

import { DOMRunnerFactory, DOMRunnerInterface, DOMRunnerMessage } from "./ObservableDOM";

const ErrDOMWindowNotInitialized = "DOMWindow not initialized";

// TODO - remove this monkeypatching if it's possible to avoid the race conditions in naive MutationObserver usage
const monkeyPatchedMutationRecordCallbacks = new Set<() => void>();
function installMutationObserverMonkeyPatch() {
  /*
   This monkey patch replaces the `createImpl` exported function implementation in the `MutationRecord` class in JSDOM
   to insert an iteration through callbacks that are therefore fired before a subsequent MutationRecord is created.
   This provides an opportunity to invoke the MutationObservers with a single MutationRecord rather than multiple.

   This is necessary as (at least intuitive) usage of the MutationObserver API does not enable creating accurate
   incremental diffs as the handling of all-but-the-last MutationRecord in a list requires collecting state from the
   DOM that has been since been mutated further. (e.g. if an attribute is changed twice in a row the first event cannot
   discover the intermediate value of the attribute as it can only query the latest DOM state). Whilst this simple case
   is solvable by walking backwards through the list of MutationRecords and using `oldValue` there are cases where adding
   child elements with the correct attributes is not possible when handling intermediate diffs.
  */
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const MutationRecordExports = require("jsdom/lib/jsdom/living/generated/MutationRecord");
  const originalCreateImpl = MutationRecordExports.createImpl;
  // This overwrites the function property on the exports that mutation-observers.js uses to create MutationRecords.
  MutationRecordExports.createImpl = (...args: any[]) => {
    for (const callback of monkeyPatchedMutationRecordCallbacks) {
      callback();
    }
    return originalCreateImpl.call(null, ...args);
  };
}
let monkeyPatchInstalled = false;

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

export class JSDOMRunner {
  private monkeyPatchMutationRecordCallback: () => void;

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
  ) {
    this.htmlPath = htmlPath;
    this.callback = callback;

    if (!monkeyPatchInstalled) {
      installMutationObserverMonkeyPatch();
      monkeyPatchInstalled = true;
    }

    this.monkeyPatchMutationRecordCallback = () => {
      /*
       This is called before every creation of a MutationRecord so that it can be used to process an existing record to
       avoid handling multiple MutationRecords at a time (see comment at the top of this file).
      */
      const records = this.mutationObserver?.takeRecords();
      if (records && records.length > 1) {
        throw new Error(
          "The monkey patching should have prevented more than one record being handled at a time",
        );
      } else if (records && records.length > 0) {
        this.callback({
          mutationList: records,
        });
      }
    };
    monkeyPatchedMutationRecordCallbacks.add(this.monkeyPatchMutationRecordCallback);

    this.jsdom = new JSDOM(htmlContents, {
      runScripts: "dangerously",
      resources: new RejectionResourceLoader(),
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
    monkeyPatchedMutationRecordCallbacks.delete(this.monkeyPatchMutationRecordCallback);
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
