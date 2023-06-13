import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";

const defaultAudioVolume = 1;
const defaultAudioRefDistance = 1;
const defaultAudioRolloffFactor = 1;
const defaultAudioLoop = true;
const defaultAudioEnabled = true;
const defaultAudioStartTime = 0;
const defaultAudioPauseTime = null;
const defaultAudioSrc = null;

export class Audio extends TransformableElement {
  static tagName = "m-audio";




  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Audio.attributeHandler.getAttributes()];
  }










  private props = {
    startTime: defaultAudioStartTime,
    pauseTime: defaultAudioPauseTime as number | null,
    src: defaultAudioSrc as string | null,
    loop: defaultAudioLoop,
    enabled: defaultAudioEnabled,
    volume: defaultAudioVolume,
    refDistance: defaultAudioRefDistance,
    rolloffFactor: defaultAudioRolloffFactor,
    debug: false,
  };

















  private static attributeHandler = new AttributeHandler<Audio>({
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultAudioEnabled);
      instance.updateAudio();
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultAudioLoop);
      instance.updateAudio();
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultAudioStartTime);
      if (instance.loadedAudioState) {
        instance.syncAudioTime();
      }
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultAudioPauseTime);
      if (instance.loadedAudioState) {
        instance.syncAudioTime();
      }
    },
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.updateAudio();
    },
    volume: (instance, newValue) => {
      instance.props.volume = parseFloatAttribute(newValue, defaultAudioVolume);
      if (instance.loadedAudioState) {
        instance.loadedAudioState?.positionalAudio.setVolume(instance.props.volume);
      }
    },
    "ref-distance": (instance, newValue) => {
      instance.props.refDistance = parseFloatAttribute(newValue, defaultAudioRefDistance);
      if (instance.loadedAudioState) {
        instance.loadedAudioState?.positionalAudio.setRefDistance(instance.props.refDistance);
      }
    },
    "roll-off": (instance, newValue) => {
      instance.props.rolloffFactor = parseFloatAttribute(newValue, defaultAudioRolloffFactor);
      if (instance.loadedAudioState) {
        instance.loadedAudioState?.positionalAudio.setRefDistance(instance.props.rolloffFactor);
      }
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, false);
    },
  });

  constructor() {
    super();
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {

  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Audio.attributeHandler.handle(this, name, newValue);
    this.updateDebugVisualisation();
  }





    }

    if (!this.props.src) {










      if (!this.props.enabled) {














      if (this.props.pauseTime !== null) {
        if (documentTime !== null && this.props.pauseTime > documentTime) {






          }, this.props.pauseTime - documentTime);



          let totalPlaybackTime = (this.props.pauseTime - this.props.startTime) / 1000.0;




          if (this.props.loop) {













        currentTime = (documentTime - this.props.startTime) / 1000;

        currentTime = (this.props.startTime ? this.props.startTime : 0) / 1000;















      } else if (this.props.loop) {






      if (this.props.loop) {


















        }
      }
















      }
    }
  }





  }



      return;
    }


























    }


    if (!this.props.src) {












      tag.loop = this.props.loop;

      if (tag.src !== this.props.src) {







          tag.src = this.props.src;























  }







    }










  }









    if (!this.props.debug) {


















          (this.props.refDistance / 0.5 + this.props.refDistance * (this.props.rolloffFactor - 1)) /
          this.props.rolloffFactor;

        this.debugMeshes[0].scale.set(
          this.props.refDistance,
          this.props.refDistance,
          this.props.refDistance,
        );





}
