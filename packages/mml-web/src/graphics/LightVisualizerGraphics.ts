import { MMLColor } from "../color";
import { Light, LightTypes } from "../elements";
import { ArrowHelperVisualizerGraphics } from "./ArrowHelperVisualizerGraphics";
import { GraphicsAdapter } from "./GraphicsAdapter";
import { BillboardVisualizerGraphics } from "./BillboardVisualizerGraphics";
import { PointLightHelperVisualizerGraphics } from "./PointLightHelperVisualizerGraphics";
import { SpotLightHelperVisualizerGraphics } from "./SpotLightHelperVisualizerGraphics";
import { ElementVisualizer } from "./Visualizer";


/**
 * Inline SVG and sizing for the light billboard icon.
 */
const LIGHT_BULB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm2 14h-4v-1h4v1zm0-2h-4v-1h4v1zm-1.5 5h-1c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h1c.28 0 .5.22.5.5s-.22.5-.5.5zm1.5-1h-3c-.55 0-1-.45-1-1h5c0 .55-.45 1-1 1z"/>
  <circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.5"/>
</svg>`;

const LIGHT_ICON_SIZE = 0.5;

const ARROW_LENGTH = 0.75;

type LightHelperVisualizer =
  | PointLightHelperVisualizerGraphics
  | SpotLightHelperVisualizerGraphics;

type LightVisualizerContainer = {
  visible: boolean;
};

export class LightVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter>
  implements ElementVisualizer<G>
{
  private lightBillboardIconGraphics: BillboardVisualizerGraphics;
  private lightHelperGraphics: LightHelperVisualizer;
  private arrowVisualizer: ArrowHelperVisualizerGraphics | null;
  private container: LightVisualizerContainer = { visible: true };
  private selected = false;
  private enabled = true;

  constructor(private light: Light<G>) {
    const graphicsAdapter = this.light.getScene().getGraphicsAdapter();
    const factory = graphicsAdapter.getGraphicsAdapterFactory();

    this.lightBillboardIconGraphics = factory.BillboardVisualizerGraphicsInterface(
      this.light,
      LIGHT_BULB_SVG,
      LIGHT_ICON_SIZE,
      this.light.props.color,
    );

    this.lightHelperGraphics = this.createHelperVisualizer({
      type: light.props.type,
      angleDeg: light.props.angleDeg,
      distance: light.props.distance,
      color: light.props.color,
    });

    this.arrowVisualizer = this.createArrowVisualizer({
      type: light.props.type,
      distance: ARROW_LENGTH,
      color: light.props.color,
    });
  }

  getContainer(): G["containerType"] {
    return this.container as unknown as G["containerType"];
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.updateVisibility();
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
    this.updateVisibility();
  }

  enable(): void {
    this.setEnabled(true);
  }

  disable(): void {
    this.setEnabled(false);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateVisibility();
  }

  setAngle(angle: number): void {
    if (this.lightHelperGraphics instanceof SpotLightHelperVisualizerGraphics) {
      this.lightHelperGraphics.setAngle(angle);
    }
  }

  setDistance(distance: number | null): void {
    if (this.lightHelperGraphics instanceof SpotLightHelperVisualizerGraphics) {
      this.lightHelperGraphics.setDistance(distance);
    } else if (this.lightHelperGraphics instanceof PointLightHelperVisualizerGraphics) {
      this.lightHelperGraphics.setDistance(distance);
    }
  }

  setType(type: LightTypes): void {
    // Recreate helper visualizer for new type
    this.lightHelperGraphics.dispose();
    this.lightHelperGraphics = this.createHelperVisualizer({
      type,
      angleDeg: this.light.props.angleDeg,
      distance: this.light.props.distance,
      color: this.light.props.color,
    });

    if (this.arrowVisualizer) {
      this.arrowVisualizer.dispose();
    }
    this.arrowVisualizer = this.createArrowVisualizer({
      type,
      distance: ARROW_LENGTH,
      color: this.light.props.color,
    });
    this.updateVisibility();
  }

  setColor(color: MMLColor): void {
    this.lightBillboardIconGraphics.setColor(color);
    if (this.lightHelperGraphics instanceof SpotLightHelperVisualizerGraphics) {
      this.lightHelperGraphics.setColor(color);
    } else if (this.lightHelperGraphics instanceof PointLightHelperVisualizerGraphics) {
      this.lightHelperGraphics.setColor(color);
    }

    if (this.arrowVisualizer) {
      this.arrowVisualizer.setColor(color);
    }
  }

  dispose(): void {
    this.lightBillboardIconGraphics.dispose();
    this.lightHelperGraphics.dispose();
    this.arrowVisualizer?.dispose();
    this.container = null as unknown as LightVisualizerContainer;
  }

  private updateVisibility(): void {
    const shouldShow = this.container.visible && this.enabled;

    if (!shouldShow) {
      // this.lightBillboardIconGraphics.disable();
      this.lightHelperGraphics?.setVisible(false);
      this.arrowVisualizer?.setVisible(false);
      return;
    }

    this.arrowVisualizer?.setVisible(true);

    if (this.selected) {
      // this.lightBillboardIconGraphics.disable();
      this.lightHelperGraphics?.setVisible(true);
    } else {
      // this.lightBillboardIconGraphics.enable();
      this.lightHelperGraphics?.setVisible(false);
    }
  }

  private createHelperVisualizer({
    type,
    angleDeg,
    distance,
    color,
  }: {
    type: LightTypes;
    angleDeg: number;
    distance: number | null;
    color: MMLColor;
  }): LightHelperVisualizer {
    if (type === LightTypes.point) {
      return this.light
        .getScene()
        .getGraphicsAdapter()
        .getGraphicsAdapterFactory()
        .PointLightHelperVisualizerGraphicsInterface(this.light, distance, color, { clickable: false });
    }

    return this.light
      .getScene()
      .getGraphicsAdapter()
      .getGraphicsAdapterFactory()
      .SpotLightHelperVisualizerGraphicsInterface(this.light, angleDeg, distance, color, {
        clickable: false,
      });
  }

  private createArrowVisualizer({
    type,
    distance,
    color,
  }: {
    type: LightTypes;
    distance: number | null;
    color: MMLColor;
  }): ArrowHelperVisualizerGraphics | null {
    if (type !== LightTypes.spotlight) {
      return null;
    }

    return this.light
      .getScene()
      .getGraphicsAdapter()
      .getGraphicsAdapterFactory()
      .ArrowHelperVisualizerGraphicsInterface(this.light, distance, color, { clickable: false });
  }
}
