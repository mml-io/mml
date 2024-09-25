import { GroupDefinition } from "./FieldDefinition";
import sharedStyles from "./shared-styles.module.css";
import { UIElement } from "./UIElement";
import styles from "./UIGroup.module.css";

export class UIGroup {
  public readonly element = document.createElement("div");
  private header: HTMLDivElement;

  constructor(public readonly groupDefinition: GroupDefinition) {
    this.element.className = styles.uiGroup;
    this.header = document.createElement("div");
    this.header.className = sharedStyles.header;
    this.header.textContent = groupDefinition.label;
    this.element.append(this.header);
  }

  private elements: Array<UIElement> = new Array<UIElement>();

  addElement(element: UIElement) {
    if (this.elements.includes(element)) {
      return;
    }
    this.elements.push(element);
    this.element.append(element.element);
  }

  removeElement(element: UIElement) {
    const index = this.elements.indexOf(element);
    if (index === -1) {
      return;
    }
    this.elements.splice(index, 1);
  }

  dispose() {
    for (const element of this.elements) {
      element.dispose();
    }
    this.elements = [];
  }

  isEmpty() {
    return this.elements.length === 0;
  }
}
