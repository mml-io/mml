export function createFullscreenDiv(): HTMLDivElement {
  const element = document.createElement("div");
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.position = "relative";
  document.body.append(element);
  return element;
}
