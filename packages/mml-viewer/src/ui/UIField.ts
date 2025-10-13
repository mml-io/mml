import { FieldDefinition } from "./FieldDefinition";
import { setUrlParam } from "./setUrlParam";
import sharedStyles from "./shared-styles.module.css";
import { UIElement } from "./UIElement";
import styles from "./UIField.module.css";
import { UIGroup } from "./UIGroup";

export class UIField extends UIElement {
  private label: HTMLLabelElement;
  private input?: HTMLInputElement;

  private selectElement?: HTMLSelectElement;

  private submitButton?: HTMLButtonElement;
  private actionButton?: HTMLButtonElement;

  constructor(
    public fieldDefinition: FieldDefinition,
    public readonly group: UIGroup,
  ) {
    super();
    this.element.className = styles.uiField;

    this.label = document.createElement("label");
    this.label.className = styles.label;
    this.label.textContent = fieldDefinition.label;
    this.element.append(this.label);

    if (fieldDefinition.type === "action") {
      this.element.classList.add(styles.actionField);
      this.actionButton = document.createElement("button");
      this.actionButton.classList.add(sharedStyles.button, styles.submitButton);
      this.actionButton.textContent = fieldDefinition.label;
      this.actionButton.addEventListener("click", () => {
        try {
          if (this.fieldDefinition.onClick) {
            this.fieldDefinition.onClick();
          }
        } catch (e) {
          console.warn("UI action handler threw:", e);
        }
      });
      this.label.textContent = "";
      this.element.append(this.actionButton);
    } else if (fieldDefinition.options) {
      const selectElement = document.createElement("select");
      this.selectElement = selectElement;
      this.selectElement.className = styles.selectInput;

      const unsetOption = document.createElement("option");
      unsetOption.textContent = "Unset (default: " + fieldDefinition.defaultValue + ")";
      unsetOption.value = "";
      this.selectElement.append(unsetOption);
      this.element.append(this.selectElement);

      for (const option of fieldDefinition.options) {
        const optionElement = document.createElement("option");
        optionElement.textContent = option;
        this.selectElement.append(optionElement);
      }

      if (fieldDefinition.requireSubmission) {
        this.submitButton = document.createElement("button");
        this.submitButton.classList.add(sharedStyles.button, styles.submitButton);
        this.submitButton.textContent = "Submit";
        this.submitButton.addEventListener("click", () => {
          this.onChange(selectElement.value);
        });
        this.element.append(this.submitButton);
      } else {
        this.selectElement.addEventListener("change", () => {
          this.onChange(selectElement.value);
        });
      }
    } else {
      const input = document.createElement("input");
      this.input = input;
      this.input.className = styles.textInput;
      this.input.placeholder = `Default: ${fieldDefinition.defaultValue.toString()}`;
      this.input.addEventListener("focus", () => {
        this.label.classList.add(styles.labelFocused);
      });
      this.input.addEventListener("blur", () => {
        this.label.classList.remove(styles.labelFocused);
      });
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          this.onChange(input.value);
        }
      });
      if (fieldDefinition.type === "number") {
        this.input.step = "0.01";
        this.input.type = "number";
      } else if (fieldDefinition.type === "color") {
        this.input.type = "text";
      } else if (fieldDefinition.type === "boolean") {
        this.input.type = "checkbox";
      } else {
        this.input.type = "text";
      }
      this.element.append(this.input);

      if (fieldDefinition.requireSubmission) {
        this.submitButton = document.createElement("button");
        this.submitButton.classList.add(sharedStyles.button, styles.submitButton);
        this.submitButton.textContent = "Submit";
        this.submitButton.addEventListener("click", () => {
          if (this.input) {
            this.onChange(this.input.value);
          } else if (this.selectElement) {
            this.onChange(this.selectElement.value);
          }
        });
        this.element.append(this.submitButton);
      } else {
        if (this.input) {
          const input = this.input;
          this.input.addEventListener("input", () => {
            if (input.type === "checkbox") {
              this.onChange(input.checked ? "true" : "false");
              return;
            }
            this.onChange(input.value);
          });
        } else if (this.selectElement) {
          const selectElement = this.selectElement;
          this.selectElement.addEventListener("change", () => {
            this.onChange(selectElement.value);
          });
        }
      }
    }

    if (fieldDefinition.type !== "action") {
      const params = new URLSearchParams(window.location.search);
      const value = params.get(fieldDefinition.name);
      if (value) {
        this.setValue(value);
      }
    }
  }

  setValue(value: string) {
    if (this.fieldDefinition.type === "action") {
      return;
    }
    if (this.selectElement) {
      this.selectElement.value = value;
    } else if (this.input) {
      if (this.input.type === "checkbox") {
        this.input.checked = value === "true";
      } else {
        this.input.value = value;
      }
    }
  }

  onChange(value: string) {
    if (this.fieldDefinition.type === "action") {
      return;
    }
    if (this.fieldDefinition.type === "boolean") {
      value = value === "true" || value === "on" || value === "1" ? "true" : "false";
    }
    setUrlParam(this.fieldDefinition.name, value);
  }
}
