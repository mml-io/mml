

import { TransformableElement } from "./TransformableElement";
import { IMMLScene } from "../MMLScene";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";

const defaultInteractionRange = 1;
const defaultInteractionInFocus = true;
const defaultInteractionLineOfSight = false;
const defaultInteractionPriority = 1;
const defaultInteractionPrompt = null;
const defaultInteractionDebug = false;

export class Interaction extends TransformableElement {

  private static attributeHandler = new AttributeHandler<Interaction>({
    range: (instance, newValue) => {
      instance.props.range = parseFloatAttribute(newValue, defaultInteractionRange);
    },
    "in-focus": (instance, newValue) => {
      instance.props.inFocus = parseBoolAttribute(newValue, defaultInteractionInFocus);
    },
    "line-of-sight": (instance, newValue) => {
      instance.props.lineOfSight = parseBoolAttribute(newValue, defaultInteractionLineOfSight);
    },
    priority: (instance, newValue) => {
      instance.props.priority = parseFloatAttribute(newValue, defaultInteractionPriority);
    },
    prompt: (instance, newValue) => {
      instance.props.prompt = newValue;
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultInteractionDebug);
    },
  });
  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Interaction.attributeHandler.getAttributes(),
    ];


  public readonly props = {
    range: defaultInteractionRange as number,
    inFocus: defaultInteractionInFocus as boolean,
    lineOfSight: defaultInteractionLineOfSight as boolean,
    priority: defaultInteractionPriority as number,
    prompt: defaultInteractionPrompt as string | null,
    debug: defaultInteractionDebug as boolean,
  };


  private registeredScene: IMMLScene | null = null;





  public parentTransformed(): void {
    this.registeredScene?.updateInteraction(this);
  }

  public isClickable(): boolean {
    return false;
  }



    this.showDebug();
    this.registerInteraction(this);



    this.unregisterInteraction(this);
    this.showDebug();



  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {

    if (TransformableElement.observedAttributes.includes(name)) {
      if (this.registeredScene !== null) {
        this.registeredScene.updateInteraction(this);
      }
      this.showDebug();
    }
    if (Interaction.attributeHandler.handle(this, name, newValue)) {
      this.showDebug();
      if (this.registeredScene !== null) {
        this.registeredScene.updateInteraction(this);
      }
    }


  public trigger() {



  private showDebug() {
    if (!this.props.debug && this.debugMesh) {
      this.debugMesh.removeFromParent();
      this.debugMesh = null;
      return;
    }

    if (this.props.debug && !this.debugMesh && this.container.parent) {

        new THREE.SphereGeometry(1, 32, 32),


      this.container.add(this.debugMesh);
    }

    if (this.debugMesh) {


      const scale = this.props.range;




          scale / parentWorldScale.x,
          scale / parentWorldScale.y,
          scale / parentWorldScale.z,





  private registerInteraction(int: Interaction) {
    const scene = this.getScene();
    this.registeredScene = scene;
    scene.addInteraction(int);


  private unregisterInteraction(int: Interaction) {
    if (this.registeredScene !== null) {
      this.registeredScene.removeInteraction(int);
      this.registeredScene = null;

  }

