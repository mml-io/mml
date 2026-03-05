import {
  IDocumentFactory,
  IElementLike,
  IPortalElement,
  VIRTUAL_DOCUMENT_BRAND,
} from "@mml-io/networked-dom-web";

import { AttributeHandler, parseEnumAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter, OverlayGraphics } from "../graphics";
import { getGlobalDocument } from "../runtime-env";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

export enum OverlayAnchor {
  "top-left" = "top-left",
  "top-center" = "top-center",
  "top-right" = "top-right",
  "center-left" = "center-left",
  "center" = "center",
  "center-right" = "center-right",
  "bottom-left" = "bottom-left",
  "bottom-center" = "bottom-center",
  "bottom-right" = "bottom-right",
}

export type MOverlayProps = {
  href: string | null;
  target: string | null;
  anchor: OverlayAnchor;
  offsetX: number;
  offsetY: number;
};

enum OverlayMode {
  // The overlay element is not yet attached to the DOM
  PENDING = "pending",
  // The overlay element is from a remote document and the children are applied to a portal element
  PORTAL = "portal",
  // The overlay element is in a local document and the overlay element is directly styled as the presentational element
  DIRECT = "direct",
}

export class Overlay<G extends GraphicsAdapter = GraphicsAdapter>
  extends TransformableElement<G>
  implements IPortalElement
{
  static tagName = "m-overlay";
  private overlayGraphics: OverlayGraphics<G> | null = null;
  private overlayElement: IElementLike | null = null;

  private mode: OverlayMode = OverlayMode.PENDING;

  public props: MOverlayProps = {
    href: null,
    target: null,
    anchor: OverlayAnchor["top-left"],
    offsetX: 0,
    offsetY: 0,
  };

  private static attributeHandler = new AttributeHandler<Overlay<GraphicsAdapter>>({
    href: (instance, newValue) => {
      instance.props.href = newValue !== null ? newValue : null;
    },
    target: (instance, newValue) => {
      instance.props.target = newValue !== null ? newValue : null;
    },
    anchor: (instance, newValue) => {
      instance.props.anchor = parseEnumAttribute(
        newValue,
        OverlayAnchor,
        OverlayAnchor["top-left"],
      );
      instance.updateOverlayElementPosition();
    },
    "offset-x": (instance, newValue) => {
      instance.props.offsetX = parseFloatAttribute(newValue, 0);
      instance.updateOverlayElementPosition();
    },
    "offset-y": (instance, newValue) => {
      instance.props.offsetY = parseFloatAttribute(newValue, 0);
      instance.updateOverlayElementPosition();
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Overlay.attributeHandler.getAttributes(),
    ];
  }

  constructor() {
    super();
  }

  private updateOverlayElementPosition(): void {
    if (!this.overlayElement) {
      return;
    }

    this.overlayElement.style.position = "absolute";
    this.overlayElement.style.zIndex = "1000";

    switch (this.props.anchor) {
      case OverlayAnchor["top-left"]:
        this.overlayElement.style.top = `0`;
        this.overlayElement.style.left = `0`;
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "top left";
        this.overlayElement.style.transform = `translateX(calc(${this.props.offsetX}px)) translateY(${this.props.offsetY}px)`;
        break;
      case OverlayAnchor["top-center"]:
        this.overlayElement.style.top = `0`;
        this.overlayElement.style.left = `50%`;
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "top center";
        this.overlayElement.style.transform = `translateX(calc(-50% + ${this.props.offsetX}px)) translateY(${this.props.offsetY}px)`;
        break;
      case OverlayAnchor["top-right"]:
        this.overlayElement.style.top = `0`;
        this.overlayElement.style.right = `0`;
        this.overlayElement.style.left = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "top right";
        this.overlayElement.style.transform = `translateX(${this.props.offsetX}px) translateY(${this.props.offsetY}px)`;
        break;
      case OverlayAnchor["center-left"]:
        this.overlayElement.style.top = "50%";
        this.overlayElement.style.left = `0`;
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "center left";
        this.overlayElement.style.transform = `translateX(calc(${this.props.offsetX}px)) translateY(calc(-50% + ${this.props.offsetY}px))`;
        break;
      case OverlayAnchor["center"]:
        this.overlayElement.style.top = "50%";
        this.overlayElement.style.left = "50%";
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "center";
        this.overlayElement.style.transform = `translate(calc(-50% + ${this.props.offsetX}px), calc(-50% + ${this.props.offsetY}px))`;
        break;
      case OverlayAnchor["center-right"]:
        this.overlayElement.style.top = "50%";
        this.overlayElement.style.left = "100%";
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "center right";
        this.overlayElement.style.transform = `translateX(calc(-100% + ${this.props.offsetX}px)) translateY(calc(-50% + ${this.props.offsetY}px))`;
        break;
      case OverlayAnchor["bottom-left"]:
        this.overlayElement.style.top = "100%";
        this.overlayElement.style.left = `${this.props.offsetX}px`;
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "bottom left";
        this.overlayElement.style.transform = `translateX(${this.props.offsetX}px) translateY(calc(-100% + ${this.props.offsetY}px))`;
        break;
      case OverlayAnchor["bottom-center"]:
        this.overlayElement.style.top = "100%";
        this.overlayElement.style.left = "50%";
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "bottom center";
        this.overlayElement.style.transform = `translateX(calc(-50% + ${this.props.offsetX}px)) translateY(calc(-100% + ${this.props.offsetY}px))`;
        break;
      case OverlayAnchor["bottom-right"]:
        this.overlayElement.style.top = "100%";
        this.overlayElement.style.left = "100%";
        this.overlayElement.style.right = ``;
        this.overlayElement.style.bottom = ``;
        this.overlayElement.style.transformOrigin = "bottom right";
        this.overlayElement.style.transform = `translateX(calc(-100% + ${this.props.offsetX}px)) translateY(calc(-100% + ${this.props.offsetY}px))`;
        break;
      default:
        throw new Error(`Unknown anchor: ${this.props.anchor}`);
    }
  }

  private isVirtualMode(): boolean {
    return !!(this.ownerDocument && (this.ownerDocument as any)[VIRTUAL_DOCUMENT_BRAND] === true);
  }

  public getPortalDocumentFactory(): IDocumentFactory | null {
    if (this.isVirtualMode()) {
      return getGlobalDocument() ?? null;
    }
    return null;
  }

  public getPortalElement(): IElementLike {
    if (this.mode === OverlayMode.DIRECT) {
      return this;
    } else if (this.mode === OverlayMode.PORTAL) {
      if (!this.overlayElement) {
        throw new Error("Overlay element is not set");
      }
      return this.overlayElement;
    }
    throw new Error("Unknown overlay mode");
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.transformableElementGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Overlay.attributeHandler.handle(this, name, newValue);
  }

  protected disable(): void {
    // no-op
  }

  protected enable(): void {
    // no-op
  }

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.overlayGraphics) {
      return;
    }

    const remoteDocument = this.getInitiatedRemoteDocument();
    const isVirtual = this.isVirtualMode();
    const realDoc = getGlobalDocument();

    // Determine whether we can create a real DOM portal for visual presentation.
    // A portal requires a remote document AND a real DOM to host the overlay div.
    const canCreatePortal = remoteDocument && (!isVirtual || !!realDoc);

    if (canCreatePortal) {
      this.mode = OverlayMode.PORTAL;

      // Within canCreatePortal: if isVirtual then realDoc is guaranteed truthy;
      // otherwise ownerDocument is always available on an attached element.
      const docForPortal = (isVirtual ? realDoc : this.ownerDocument) as Document;
      const createdOverlay = docForPortal.createElement("div") as IElementLike;
      this.overlayElement = createdOverlay;
      createdOverlay.addEventListener("click", (event: Event) => {
        event.stopImmediatePropagation();
        event.preventDefault();

        const remoteDocument = this.getInitiatedRemoteDocument();
        if (remoteDocument && event.target) {
          remoteDocument.dispatchEvent(
            MElement.createConsumeEvent(event.target as MElement, event),
          );
        }
      });

      const parentElement = this.getScene().getOverlayElement?.();
      if (parentElement) {
        parentElement.appendChild(this.overlayElement);
      } else {
        console.warn(
          "An m-overlay element was found but getOverlayElement was not provided by the scene",
        );
      }

      if (!isVirtual) {
        // Non-virtual: move existing children to the portal element
        for (const child of Array.from(this.childNodes)) {
          this.overlayElement.appendChild(child);
        }
      }
      // Virtual mode: children are buffered by the adapter and will be flushed
      // to the portal element after this connectedCallback returns
    } else {
      // No portal: either a local document or headless virtual mode.
      // Children stay on this element directly.
      this.mode = OverlayMode.DIRECT;
      this.overlayElement = this;
    }

    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.overlayGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLOverlayGraphicsInterface(this);

    for (const name of Overlay.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.updateOverlayElementPosition();
  }

  public disconnectedCallback(): void {
    this.overlayGraphics?.dispose();
    this.overlayGraphics = null;
    this.overlayElement?.remove();
    super.disconnectedCallback();
  }
}
