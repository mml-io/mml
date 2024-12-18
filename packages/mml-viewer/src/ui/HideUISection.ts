import styles from "./HideUISection.module.css";
import { setUrlParam } from "./setUrlParam";
import sharedStyles from "./shared-styles.module.css";
import tooltipStyles from "./tooltip.module.css";

export class HideUISection {
  public readonly element: HTMLDivElement;
  private hideUiButton: HTMLButtonElement;
  private hideUiHeader: HTMLDivElement;
  private hideUiSectionContents: HTMLDivElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = styles.hideUiSection;

    this.hideUiHeader = document.createElement("div");
    this.hideUiHeader.textContent = "Hide UI";
    this.hideUiHeader.className = sharedStyles.header;
    this.element.append(this.hideUiHeader);

    this.hideUiSectionContents = document.createElement("div");
    this.hideUiSectionContents.className = styles.hideUiSectionContents;
    this.element.append(this.hideUiSectionContents);

    this.hideUiButton = document.createElement("button");
    this.hideUiButton.className = sharedStyles.button;
    this.hideUiButton.textContent = "Hide UI";
    this.hideUiButton.addEventListener("click", () => {
      setUrlParam("noUI", "true");
    });
    this.hideUiSectionContents.append(this.hideUiButton);

    const warningIcon = document.createElement("span");
    warningIcon.className = tooltipStyles.tooltip;
    warningIcon.setAttribute("data-direction", "left");
    const warningIconText = document.createElement("span");
    warningIconText.className = tooltipStyles.tooltipInitiator;
    warningIconText.textContent = "⚠️";
    warningIcon.append(warningIconText);
    const warningTooltip = document.createElement("span");
    warningTooltip.className = tooltipStyles.tooltipItem;
    warningTooltip.textContent =
      "If you hide the UI, it can only be shown again by removing the noUI parameter from the URL";
    warningIcon.append(warningTooltip);
    this.hideUiSectionContents.append(warningIcon);
  }

  show() {
    this.element.classList.remove(styles.hidden);
  }

  hide() {
    this.element.classList.add(styles.hidden);
  }
}
