import { setUrlParam } from "./setUrlParam";
import sharedStyles from "./shared-styles.module.css";
import tooltipStyles from "./tooltip.module.css";
import styles from "./UnusedParameters.module.css";

export class UnusedParameters {
  public readonly element: HTMLDivElement;
  private header: HTMLDivElement;
  private paramsHolder: HTMLDivElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.classList.add(styles.unusedParameters, styles.hidden);

    this.header = document.createElement("div");
    this.header.textContent = "Unused Parameters";
    this.header.className = sharedStyles.header;
    this.element.append(this.header);

    const warningIcon = document.createElement("span");
    warningIcon.className = tooltipStyles.tooltip;
    warningIcon.setAttribute("data-direction", "left");
    const warningIconText = document.createElement("span");
    warningIconText.className = tooltipStyles.tooltipInitiator;
    warningIconText.textContent = "⚠️";
    warningIcon.append(warningIconText);
    const warningTooltip = document.createElement("span");
    warningTooltip.className = tooltipStyles.tooltipItem;
    warningTooltip.textContent = "These parameters are not used by the viewer";
    warningIcon.append(warningTooltip);
    this.header.append(warningIcon);

    this.paramsHolder = document.createElement("div");
    this.element.append(this.paramsHolder);
  }

  setParams(params: string[]) {
    this.paramsHolder.innerHTML = "";
    if (params.length === 0) {
      this.element.classList.add(styles.hidden);
      return;
    }

    this.element.classList.remove(styles.hidden);

    for (const param of params) {
      const listItem = document.createElement("div");
      listItem.className = styles.paramListItem;
      const paramName = document.createElement("div");
      paramName.textContent = param;
      listItem.append(paramName);
      const removeButton = document.createElement("button");
      removeButton.className = sharedStyles.button;
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        setUrlParam(param, null);
      });
      listItem.append(removeButton);
      this.paramsHolder.append(listItem);
    }
  }
}
