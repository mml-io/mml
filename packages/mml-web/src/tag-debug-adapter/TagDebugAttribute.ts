import { MMLColor } from "../graphics/MMLColor";
import { TagAdapterThemeColors } from "./TagAdapterThemeColors";

export class TagDebugAttribute {
  public element: HTMLElement;

  private readonly valueSpan: HTMLSpanElement;

  private appliedValue: {
    raw: number | string | MMLColor | boolean;
    displayString: string;
    asString: string;
  } | null = null;
  private readonly appliedValueSpan: HTMLSpanElement;

  constructor(
    public key: string,
    public value: string | null,
    private theme: TagAdapterThemeColors,
    private isObserved: boolean,
  ) {
    this.element = document.createElement("span");

    if (!isObserved) {
      this.element.style.borderBottomStyle = "dotted";
      this.element.style.borderWidth = "2px";
      this.element.style.borderColor = this.theme.unrecognizedAttribute;
    }

    const keySpan = document.createElement("span");
    keySpan.textContent = ` ${key}`;
    keySpan.style.color = this.theme.attribute;

    const equalsSpan = document.createElement("span");
    equalsSpan.textContent = "=";
    equalsSpan.style.color = this.theme.equals;

    const quoteSpan = document.createElement("span");
    quoteSpan.textContent = `"`;
    quoteSpan.style.color = this.theme.quote;

    this.valueSpan = document.createElement("span");
    this.valueSpan.textContent = value;
    this.valueSpan.style.color = this.theme.value;

    const endQuoteSpan = document.createElement("span");
    endQuoteSpan.textContent = `"`;
    endQuoteSpan.style.color = this.theme.quote;

    this.appliedValueSpan = document.createElement("span");
    this.appliedValueSpan.className = "no-copy";
    this.appliedValueSpan.style.color = this.theme.appliedValue;
    this.appliedValueSpan.style.display = "none";

    this.element.append(
      keySpan,
      equalsSpan,
      quoteSpan,
      this.valueSpan,
      endQuoteSpan,
      this.appliedValueSpan,
    );
  }

  public setValue(value: string | null) {
    this.value = value;
    if (value === null) {
      this.valueSpan.textContent = "";
      this.appliedValueSpan.style.display = "none";
      if (this.appliedValue !== null) {
        this.appliedValueSpan.style.display = "inline";
      }
      return;
    }
    this.valueSpan.textContent = `${value}`;
    if (this.appliedValue !== null) {
      if (this.appliedValue.asString === value) {
        this.appliedValueSpan.style.display = "none";
      } else {
        this.appliedValueSpan.style.display = "inline";
      }
    }
  }

  public setAppliedValue(value: number | string | boolean | MMLColor | null) {
    if (value === null) {
      this.appliedValueSpan.style.display = "none";
      this.appliedValue = null;
      return;
    }
    if (typeof value === "object") {
      // Assume it is a color
      this.appliedValueSpan.style.display = "inline";
      this.appliedValueSpan.textContent = `█(${value.r}, ${value.g}, ${value.b}${value.a ? `, ${value.a}` : ""})`;
      const average = (value.r + value.g + value.b) / 3;
      this.appliedValueSpan.style.color = `rgb(${value.r * 255}, ${value.g * 255}, ${value.b * 255})`;
      this.appliedValueSpan.style.backgroundColor = average > 0.5 ? "black" : "white";
    } else {
      const asString = value.toString();
      let displayString = asString;
      if (typeof value === "number") {
        // Limit the number of decimal places
        const asFixed = value.toFixed(6);
        if (asString.length > asFixed.length) {
          displayString = asFixed;
        }
      }
      this.appliedValue = {
        raw: value,
        asString,
        displayString,
      };
      if (this.value !== null) {
        if (this.value === asString) {
          this.appliedValueSpan.style.display = "none";
          return;
        }
      }
      this.appliedValueSpan.style.display = "inline";
      this.appliedValueSpan.textContent = `(${displayString})`;
    }
  }

  hasAppliedValue() {
    return this.appliedValue !== null;
  }

  hasValue() {
    return this.value !== null;
  }
}
