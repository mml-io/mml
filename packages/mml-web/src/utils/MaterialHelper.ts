import { AttributeHandler } from "./attribute-handling";
import { Cube, Cylinder, MElement, Plane } from "../elements";
import { Material } from "../elements/Material";
import { MaterialManager } from "../elements/MaterialManager";
import { Sphere } from "../elements/Sphere";

const defaultMaterialId = "";
/**
  This helper class encapsulates most of the logic around enabling MElements with materials to accept child or global shared materials.
 */
export class MaterialElementHelper {
  private element: Cube | Cylinder | Plane | Sphere;
  public registeredChildMaterial: Material | null = null;
  private materialManager: MaterialManager;
  private props = {
    materialId: defaultMaterialId,
  };

  static AttributeHandler = new AttributeHandler<MaterialElementHelper>({
    "material-id": (instance, newValue) => {
      const oldId = instance.props.materialId;
      instance.props.materialId = newValue ?? defaultMaterialId;
      if (
        (instance.registeredChildMaterial &&
          instance.registeredChildMaterial.parentElement === instance.element) ||
        !instance.element.getRemoteDocument()
      ) {
        // Ignore changes in material id if the element has a direct child material
        // or if the document is not available
        return;
      }

      if (oldId) {
        instance.materialManager.unregisterMaterialUser(
          instance.remoteAddress,
          oldId,
          instance.element,
        );
        instance.disconnectChildMaterial();
      }
      if (instance.props.materialId) {
        instance.materialManager.registerMaterialUser(
          instance.remoteAddress,
          instance.props.materialId,
          instance.element,
        );
      }
    },
  });
  static observedAttributes = MaterialElementHelper.AttributeHandler.getAttributes();
  private remoteAddress: string;

  constructor(element: Cube | Cylinder | Plane | Sphere) {
    this.element = element;
    this.materialManager = MaterialManager.getInstance();
  }

  private enabled: boolean = true;

  public enable() {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
  }

  public disable() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
  }

  public connectedCallback() {
    // Save the remote address so we can dispose of the material when the element is removed
    this.remoteAddress = this.element.getRemoteDocument()?.getDocumentAddress() ?? "";
    if (this.props.materialId && !this.registeredChildMaterial) {
      this.materialManager.registerMaterialUser(
        this.remoteAddress,
        this.props.materialId,
        this.element,
      );
    }
  }

  public disconnectedCallback() {
    // Disconnect shared material
    if (this.props.materialId) {
      this.materialManager.unregisterMaterialUser(
        this.remoteAddress,
        this.props.materialId,
        this.element,
      );
      this.disconnectChildMaterial();
      this.registeredChildMaterial = null;
    }
  }

  public addSideEffectChild(child: MElement) {
    if (
      child instanceof Material &&
      (!this.registeredChildMaterial || child.parentElement === this.element)
    ) {
      this.registeredChildMaterial = child;
      if (child.isLoaded) {
        this.setChildMaterial(child);
      } else {
        child.addEventListener("materialLoaded", () => {
          this.setChildMaterial(child);
        });
      }
    }
  }

  public removeSideEffectChild(child: MElement) {
    if (child instanceof Material && child === this.registeredChildMaterial) {
      const isDirectChild = child.getParentAttachment() === this.element;
      const isChildStillValid = !!child.getMaterial();
      if (!isDirectChild || !isChildStillValid) {
        this.disconnectChildMaterial();
      }
    }
  }

  public handle(name: string, newValue: string) {
    MaterialElementHelper.AttributeHandler.handle(this, name, newValue);
  }

  public setChildMaterial(materialElement: Material) {
    const newMaterial = materialElement?.getMaterial();
    if (newMaterial) {
      (this.element as Cube).setMaterial(newMaterial);
      this.registeredChildMaterial = materialElement;
    }
  }

  public disconnectChildMaterial() {
    const registeredMaterialElement = this.registeredChildMaterial;
    const remoteDocument = this.element.getRemoteDocument();
    const remoteAddress = remoteDocument?.getDocumentAddress();
    const childMaterial = this.element.querySelector("m-material") as Material;
    const sharedMaterialId = this.props.materialId;
    let sharedMaterial = null;
    if (remoteDocument && remoteAddress) {
      sharedMaterial = this.materialManager.getSharedMaterialFallback(
        remoteAddress,
        sharedMaterialId,
      );
    }

    if (
      registeredMaterialElement &&
      childMaterial instanceof Material &&
      registeredMaterialElement !== childMaterial
    ) {
      // Fallback to child
      this.registeredChildMaterial = null;
      return this.element.addSideEffectChild(childMaterial);
    } else if (
      registeredMaterialElement &&
      sharedMaterial instanceof Material &&
      registeredMaterialElement !== sharedMaterial
    ) {
      // Fallback to shared material
      this.registeredChildMaterial = null;
      return this.element.addSideEffectChild(sharedMaterial);
    }
    this.element.setMaterial(this.element.getDefaultMaterial());
    this.registeredChildMaterial = null;
  }
}
