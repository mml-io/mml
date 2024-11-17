import { MMLColor } from "../color";
import { MElement } from "../elements";
import { MElementGraphics } from "../graphics";
import { IMMLScene } from "../scene";
import { TagDebugGraphicsAdapter } from "./StandaloneTagDebugAdapter";
import { TagAdapterThemeColors } from "./TagAdapterThemeColors";
import { TagDebugAttribute } from "./TagDebugAttribute";

const ignoredAttributes = new Set(["style"]);

export class TagDebugMElement implements MElementGraphics<TagDebugGraphicsAdapter> {
  private container: HTMLElement;
  private mutationObserver: MutationObserver;
  private attributesHolder: HTMLSpanElement;
  private childElementHolder: HTMLDivElement;
  private currentParent: TagDebugMElement | IMMLScene<TagDebugGraphicsAdapter> | null = null;

  private attributes: Record<string, TagDebugAttribute> = {};
  private theme: TagAdapterThemeColors;
  public indentLevel: number;
  private observedAttributes = new Set<string>();

  constructor(private mElement: MElement<TagDebugGraphicsAdapter>) {
    // @ts-expect-error - accessing __proto__ is not type safe
    const observedAttributesArray = mElement.__proto__?.constructor?.observedAttributes ?? [];
    this.observedAttributes = new Set([...observedAttributesArray, "id", "class"]);

    const graphicAdapter = mElement.getScene().getGraphicsAdapter();
    this.theme = graphicAdapter.theme;

    this.container = document.createElement("div");
    this.container.style.fontFamily = "monospace";
    this.container.style.lineHeight = "1.5em";

    const mElementParent = this.mElement.getMElementParent();
    if (mElementParent) {
      this.currentParent = mElementParent.getContainer() as TagDebugMElement;
      this.currentParent?.childElementHolder.append(this.container);
      this.indentLevel = this.currentParent.indentLevel + 1;
    } else {
      // If none of the ancestors are MElements then this element may be directly connected to the body (without a wrapper).
      // Attempt to use a global scene that has been configured to attach this element to.
      const scene = this.mElement.getScene();
      this.currentParent = scene;
      (scene.getRootContainer() as HTMLElement).append(this.container);
      this.indentLevel = 0;
    }

    const firstLine = document.createElement("div");
    firstLine.style.textWrap = "nowrap";
    const openingLineBreak = document.createElement("span");
    openingLineBreak.textContent = "\n";

    const openingBracket = document.createElement("span");
    const indent = Array(this.indentLevel * 4)
      .fill(" ")
      .join("");
    openingBracket.textContent = `${indent}<`;
    openingBracket.style.color = this.theme.brackets;
    openingBracket.style.whiteSpace = "pre";

    const openingTag = document.createElement("span");
    openingTag.textContent = mElement.tagName.toLowerCase();
    openingTag.style.color = this.theme.tag;
    this.attributesHolder = document.createElement("span");

    const openingTagEnd = document.createElement("span");
    openingTagEnd.textContent = ">";
    openingTagEnd.style.color = this.theme.brackets;

    firstLine.append(
      openingLineBreak,
      openingBracket,
      openingTag,
      this.attributesHolder,
      openingTagEnd,
    );
    this.childElementHolder = document.createElement("div");

    const closingTag = document.createElement("div");
    closingTag.style.textWrap = "nowrap";
    const closingLineBreak = document.createElement("span");
    closingLineBreak.textContent = "\n";
    const closingTagOpeningBracket = document.createElement("span");
    closingTagOpeningBracket.textContent = `${indent}</`;
    closingTagOpeningBracket.style.color = this.theme.brackets;
    closingTagOpeningBracket.style.whiteSpace = "pre";
    const closingTagName = document.createElement("span");
    closingTagName.textContent = mElement.tagName.toLowerCase();
    closingTagName.style.color = this.theme.tag;
    const closingTagEnd = document.createElement("span");
    closingTagEnd.textContent = ">";
    closingTagEnd.style.color = this.theme.brackets;
    closingTag.append(closingLineBreak, closingTagOpeningBracket, closingTagName, closingTagEnd);
    this.container.append(firstLine, this.childElementHolder, closingTag);

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          // attributeName is always set for attributes
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const attributeName = mutation.attributeName!;
          if (ignoredAttributes.has(attributeName)) {
            return;
          }
          const attributeValue = this.mElement.getAttribute(attributeName);
          const existingAttribute = this.attributes[attributeName];
          if (attributeValue === null) {
            if (existingAttribute) {
              if (!existingAttribute.hasAppliedValue()) {
                existingAttribute.element.remove();
                delete this.attributes[attributeName];
              } else {
                existingAttribute.setValue(null);
              }
            }
          } else {
            if (existingAttribute) {
              existingAttribute.setValue(attributeValue);
            } else {
              this.createAttributeElement(attributeName, attributeValue);
            }
          }
        }
      });
    });

    // Add existing attributes
    for (let i = 0; i < mElement.attributes.length; i++) {
      const attribute = mElement.attributes[i];
      if (ignoredAttributes.has(attribute.name)) {
        continue;
      }
      this.createAttributeElement(attribute.name, attribute.value);
    }

    this.mutationObserver.observe(mElement, { attributes: true });
  }

  private createAttributeElement(attributeName: string, value: string | null): TagDebugAttribute {
    const newAttribute = new TagDebugAttribute(
      attributeName,
      value,
      this.theme,
      this.observedAttributes.has(attributeName),
    );
    this.attributes[attributeName] = newAttribute;
    this.attributesHolder.append(newAttribute.element);
    return newAttribute;
  }

  public setAppliedAttributeValue(
    attributeName: string,
    value: number | string | boolean | MMLColor | null,
  ): void {
    const existingAttribute = this.attributes[attributeName];
    if (existingAttribute) {
      existingAttribute.setAppliedValue(value);
      if (value === null && !existingAttribute.hasValue()) {
        existingAttribute.element.remove();
        delete this.attributes[attributeName];
      }
    } else if (value !== null) {
      const newAttribute = this.createAttributeElement(attributeName, null);
      newAttribute.setAppliedValue(value);
    }
  }

  getContainer(): TagDebugMElement {
    return this;
  }

  dispose(): void {
    this.mutationObserver.disconnect();

    if (this.currentParent === null) {
      throw new Error("Was not connected to a parent");
    }

    if (this.currentParent instanceof TagDebugMElement) {
      this.currentParent.childElementHolder.removeChild(this.container);
      this.currentParent = null;
    } else {
      (this.currentParent.getRootContainer() as HTMLElement).removeChild(this.container);
      this.currentParent = null;
    }
  }
}
