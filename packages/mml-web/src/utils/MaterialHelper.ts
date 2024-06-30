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
        instance.registeredChildMaterial &&
        instance.registeredChildMaterial.parentElement === instance.element
      ) {
        // Ignore changes in material id if the element has a direct child material
        return;
      }

      if (oldId && instance.registeredChildMaterial) {
        instance.materialManager.unregisterMaterialUser(oldId, instance.element);
        instance.disconnectChildMaterial();
      }
      if (instance.props.materialId) {
        instance.materialManager.registerMaterialUser(instance.props.materialId, instance.element);
      }
    },
  });
  static observedAttributes = MaterialElementHelper.AttributeHandler.getAttributes();

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

  public connectedCallback() {}

  public disconnectedCallback() {
    // Disconnect shared material
    if (
      this.registeredChildMaterial &&
      this.props.materialId &&
      this.props.materialId === this.registeredChildMaterial.id
    ) {
      this.disconnectChildMaterial();
      this.materialManager.unregisterMaterialUser(this.props.materialId, this.element);
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
      this.disconnectChildMaterial();
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
    const childMaterial = this.element.querySelector("m-material") as Material;
    const sharedMaterialId = this.props.materialId;
    const sharedMaterial = document.getElementById(sharedMaterialId) as Material;
    if (
      registeredMaterialElement &&
      childMaterial instanceof Material &&
      registeredMaterialElement !== childMaterial
    ) {
      // Fallback to child
      this.registeredChildMaterial = null;
      this.element.addSideEffectChild(childMaterial);
    } else if (
      registeredMaterialElement &&
      sharedMaterial instanceof Material &&
      registeredMaterialElement !== sharedMaterial
    ) {
      // Fallback to shared material
      this.registeredChildMaterial = null;
      this.element.addSideEffectChild(sharedMaterial);
    }
    if ((!childMaterial && !sharedMaterial) || childMaterial === sharedMaterial) {
      this.element.setMaterial(this.element.getDefaultMaterial());
      this.registeredChildMaterial = null;
    }
  }
}
