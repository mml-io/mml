/**
 * Shared DOM helpers for working with MML elements.
 */

export function isMmlElement(el: Element): el is HTMLElement {
  return (el as HTMLElement).tagName?.toLowerCase().startsWith("m-");
}

export function getMmlChildren(element: HTMLElement): HTMLElement[] {
  return Array.from(element.children).filter(isMmlElement);
}
