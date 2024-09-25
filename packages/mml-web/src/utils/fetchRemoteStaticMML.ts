import { DOMSanitizer } from "@mml-io/networked-dom-web";

let domParser: DOMParser;

export async function fetchRemoteStaticMML(address: string): Promise<HTMLElement> {
  const response = await fetch(address);
  const text = await response.text();
  if (!domParser) {
    domParser = new DOMParser();
  }
  const remoteDocumentAsHTMLNode = domParser.parseFromString(text, "text/html");
  DOMSanitizer.sanitise(remoteDocumentAsHTMLNode.body);
  return remoteDocumentAsHTMLNode.body;
}
