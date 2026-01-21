import { GraphicsAdapter } from "../graphics";
import { MElement } from "./MElement";
import { setDefaultCanvasFontFamily } from "../fonts/FontRegistry";

export class Font<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-font";

  static get observedAttributes(): Array<string> {
    return ["family", "src", "format", "filename", "default"];
  }

  // No visuals; always not clickable
  public isClickable(): boolean {
    return false;
  }

  public parentTransformed(): void {
    // no-op
  }

  private getAttr(name: string): string | null {
    const value = this.getAttribute(name);
    return value === null ? null : value;
  }

  private isTrueish(value: string | null): boolean {
    if (value === null) return false;
    const v = value.trim().toLowerCase();
    return v === "" || v === "true" || v === "1" || v === "yes";
  }

  private async registerIfReady(): Promise<void> {
    const family = this.getAttr("family");
    const src = this.getAttr("src");
    if (!family || !src) return;

    const format = this.getAttr("format") as
      | "opentype"
      | "truetype"
      | "woff"
      | "woff2"
      | null;
    const filenameHint = this.getAttr("filename") || undefined;

    const absoluteOrData = this.contentSrcToContentAddress(src);
    // Encode URL to handle spaces and special characters (but not data URLs)
    const safeUrl = absoluteOrData.startsWith("data:")
      ? absoluteOrData
      : encodeURI(absoluteOrData);

    // Load via FontFace API (preferred for canvas text)
    try {
      const face = new (window as unknown as { FontFace: typeof FontFace }).FontFace(
        family,
        `url("${safeUrl}")`,
      );
      await face.load();
      (document.fonts as unknown as { add: (face: FontFace) => void }).add(face);
    } catch (error) {
      // Continue to inject CSS for CSS consumers even if FontFace load fails
      // eslint-disable-next-line no-console
      console.error("Error loading font", family, safeUrl, error);
    }

    // Also inject @font-face so CSS overlays can use it
    const style = this.ensureStyleTag();
    const fmt = (format ?? this.inferFormatFromFilename(filenameHint)) ?? "truetype";
    const css = `@font-face { font-family: '${family}'; src: url("${safeUrl}") format('${fmt}'); font-display: swap; }`;
    if (!style.textContent || !style.textContent.includes(css)) {
      style.appendChild(document.createTextNode(css + "\n"));
    }

    if (this.isTrueish(this.getAttr("default"))) {
      setDefaultCanvasFontFamily(family);
      // Ensure overlays also inherit this default font for their DOM content
      this.applyDefaultOverlayFontFamily(family);
    }
  }

  private ensureStyleTag(): HTMLStyleElement {
    let style = document.getElementById("mml-font-registry") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "mml-font-registry";
      document.head.appendChild(style);
    }
    return style;
  }

  private applyDefaultOverlayFontFamily(family: string): void {
    const id = "mml-overlay-default-font";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    // Apply default to both portal overlays and direct m-overlay elements
    // Keep rule minimal to allow user styles to override if explicitly set
    style.textContent = `[data-mml-overlay="true"], m-overlay { font-family: '${family}'; }`;
  }

  private inferFormatFromFilename(filename: string | undefined | null):
    | "opentype"
    | "truetype"
    | "woff"
    | "woff2"
    | undefined {
    if (!filename) return undefined;
    const lower = filename.toLowerCase();
    if (lower.endsWith(".otf")) return "opentype";
    if (lower.endsWith(".ttf")) return "truetype";
    if (lower.endsWith(".woff2")) return "woff2";
    if (lower.endsWith(".woff")) return "woff";
    return undefined;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    // Fire and forget; registration is idempotent enough (CSS rule guard exists)
    void this.registerIfReady();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    void this.registerIfReady();
  }
}

