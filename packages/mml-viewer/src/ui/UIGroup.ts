import { GroupDefinition } from "./FieldDefinition";
import { allFields } from "./fields";
import sharedStyles from "./shared-styles.module.css";
import { UIElement } from "./UIElement";
import { UIField } from "./UIField";
import styles from "./UIGroup.module.css";

export class UIGroup extends UIElement {
  private header: HTMLDivElement;
  private contents: HTMLDivElement;

  constructor(public readonly groupDefinition: GroupDefinition) {
    super();
    this.element.className = styles.uiGroup;
    this.header = document.createElement("div");
    this.header.className = sharedStyles.header;
    this.header.textContent = groupDefinition.label;
    this.element.append(this.header);

    this.contents = document.createElement("div");
    this.contents.className = styles.contents;
    this.element.append(this.contents);
  }

  private fields: Array<UIField> = new Array<UIField>();

  addField(uiField: UIField) {
    if (this.fields.includes(uiField)) {
      return;
    }

    this.fields.push(uiField);
    this.fields.sort(
      (a, b) => allFields.indexOf(a.fieldDefinition) - allFields.indexOf(b.fieldDefinition),
    );
    const index = this.fields.indexOf(uiField);
    if (index === this.fields.length - 1) {
      this.contents.append(uiField.element);
    } else {
      const nextGroup = this.fields[index + 1];
      this.contents.insertBefore(uiField.element, nextGroup.element);
    }
  }

  removeField(uiField: UIField) {
    this.fields = this.fields.filter((f) => f !== uiField);
    this.contents.removeChild(uiField.element);
  }

  dispose() {
    for (const element of this.fields) {
      element.dispose();
    }
    this.fields = [];
  }

  isEmpty() {
    return this.fields.length === 0;
  }
}
