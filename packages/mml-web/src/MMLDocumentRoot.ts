export class MMLDocumentRoot {
  private rootElement: HTMLElement;
  private relativeDocumentStartTime = 0;
  private overridenDocumentTime: number | null = null;
  private documentTimeListeners = new Set<(time: number) => void>();
  private documentTimeTickListeners = new Set<(time: number) => void>();

  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;
  }

  public tick() {
    const documentTime = this.getDocumentTime();
    for (const cb of this.documentTimeTickListeners) {
      cb(documentTime);
    }
  }

  public getDocumentTime(): number {
    if (this.overridenDocumentTime !== null) {
      return this.overridenDocumentTime;
    }
    return (document.timeline.currentTime as number)! - this.relativeDocumentStartTime;
  }

  public addDocumentTimeListenerCallback(cb: (time: number) => void) {
    this.documentTimeListeners.add(cb);
  }

  public removeDocumentTimeListenerCallback(cb: (time: number) => void) {
    this.documentTimeListeners.delete(cb);
  }

  public addDocumentTimeTickListenerCallback(cb: (time: number) => void) {
    this.documentTimeTickListeners.add(cb);
  }

  public removeDocumentTimeTickListenerCallback(cb: (time: number) => void) {
    this.documentTimeTickListeners.delete(cb);
  }

  public setDocumentTime(documentTime: number) {
    if (this.overridenDocumentTime !== null) {
      return;
    }
    this.relativeDocumentStartTime = (document.timeline.currentTime as number)! - documentTime;

    for (const cb of this.documentTimeListeners) {
      cb(documentTime);
    }
  }

  // This method is used for testing to allow overriding the document time
  public overrideDocumentTime(documentTime: number) {
    this.overridenDocumentTime = documentTime;

    for (const cb of this.documentTimeListeners) {
      cb(documentTime);
    }
  }
}
