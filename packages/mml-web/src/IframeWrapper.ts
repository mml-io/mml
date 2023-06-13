export class IframeWrapper {
  public readonly iframe: HTMLIFrameElement;

  constructor() {
    this.iframe = document.createElement("iframe");
    this.iframe.style.position = "fixed";
    this.iframe.style.top = "0";
    this.iframe.style.left = "0";
    this.iframe.style.width = "0";
    this.iframe.style.height = "0";
    this.iframe.style.border = "none";
  }

  append(document: DocumentFragment) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.iframe.contentWindow!.document.body.append(document);
  }
}
