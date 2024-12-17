import MMLLogoSVG from "../../../../branding/src/svg/logotype/mml-logotype-white.svg";
import { allGroups } from "./fields";
import GitHubLogoSVG from "./github-mark-white.svg";
import { HideUISection } from "./HideUISection";
import { UIGroup } from "./UIGroup";
import { UnusedParameters } from "./UnusedParameters";
import styles from "./ViewerUI.module.css";

export class ViewerUI {
  private element: HTMLDivElement;
  private contents: HTMLDivElement;

  private header: HTMLDivElement;
  private groups: Array<UIGroup> = [];
  private groupHolder: HTMLDivElement;

  private unusedParameters: UnusedParameters;
  private hideUISection: HideUISection;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = styles.viewerUi;
    this.element.addEventListener("wheel", (e) => e.stopPropagation());
    document.body.append(this.element);

    this.contents = document.createElement("div");
    this.contents.className = styles.contents;
    this.contents.style.display = "none";
    this.element.append(this.contents);

    this.header = document.createElement("div");
    this.header.className = styles.header;

    const title = document.createElement("div");
    title.className = styles.title;
    const logoLink = document.createElement("a");
    logoLink.target = "_blank";
    logoLink.href = "https://mml.io";
    const logo = document.createElement("img");
    logo.classList.add(styles.logo);
    logo.src = MMLLogoSVG;
    logo.alt = "MML";
    logoLink.append(logo);
    title.append(logoLink);
    const span = document.createElement("span");
    span.textContent = " Viewer (Alpha)";
    title.append(span);
    this.header.append(title);

    const githubLink = document.createElement("a");
    githubLink.target = "_blank";
    githubLink.className = styles.githubLink;
    githubLink.href = "https://github.com/mml-io/mml/tree/main/packages/mml-viewer";
    const githubLogo = document.createElement("img");
    githubLogo.classList.add(styles.githubLogo);
    githubLogo.src = GitHubLogoSVG;
    githubLogo.alt = "GitHub";
    githubLink.append(githubLogo);
    const githubSpan = document.createElement("span");
    githubSpan.textContent = "View Source";
    githubLink.append(githubSpan);
    this.header.append(githubLink);

    this.contents.append(this.header);

    this.groupHolder = document.createElement("div");
    this.contents.append(this.groupHolder);

    this.unusedParameters = new UnusedParameters();
    this.contents.append(this.unusedParameters.element);

    this.hideUISection = new HideUISection();
    this.contents.append(this.hideUISection.element);

    const menuIcon = document.createElement("button");
    menuIcon.classList.add(styles.menuButton, "no-copy");
    menuIcon.textContent = "≡";
    menuIcon.addEventListener("click", () => {
      this.contents.style.display = this.contents.style.display === "none" ? "block" : "none";
    });
    this.element.append(menuIcon);
  }

  addGroup(uiGroup: UIGroup) {
    this.groups.push(uiGroup);
    this.groups.sort(
      (a, b) => allGroups.indexOf(a.groupDefinition) - allGroups.indexOf(b.groupDefinition),
    );
    const index = this.groups.indexOf(uiGroup);
    if (index === this.groups.length - 1) {
      this.groupHolder.append(uiGroup.element);
    } else {
      const nextGroup = this.groups[index + 1];
      this.groupHolder.insertBefore(uiGroup.element, nextGroup.element);
    }
  }

  showUnusedParams(params: string[]) {
    this.unusedParameters.setParams(params);
  }

  showAddressMenu() {
    this.element.classList.add(styles.emptyState);
    this.contents.style.display = "block";
    this.hideUISection.hide();
  }

  hideAddressMenu() {
    this.element.classList.remove(styles.emptyState);
    this.hideUISection.show();
  }

  removeGroup(group: UIGroup) {
    this.groupHolder.removeChild(group.element);
    this.groups = this.groups.filter((g) => g !== group);
  }

  show() {
    this.element.style.display = "block";
  }

  hide() {
    this.element.style.display = "none";
  }
}
