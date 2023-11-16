import { jest } from "@jest/globals";
import jestFetchMock from "jest-fetch-mock";
import ResizeObserverPolyfill from "resize-observer-polyfill";

jestFetchMock.enableMocks();
(window as any).URL.createObjectURL = jest.fn();

// Mock the pause method for HTMLMediaElement
Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value() {
    // Add any custom logic if needed, otherwise leave the function empty
  },
});

Object.defineProperty(window, "ResizeObserver", {
  writable: false,
  configurable: false,
  value: ResizeObserverPolyfill,
});

class AudioContextMock {
  addEventListener() {
    return;
  }

  createGain(): GainNode {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      connect(destinationNode: AudioNode, output?: number, input?: number): AudioNode {
        return {} as AudioNode;
      },
      gain: {
        value: 1,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setTargetAtTime(target: number, startTime: number, timeConstant: number): AudioParam {
          return {} as AudioParam;
        },
      },
    } as GainNode;
  }

  createPanner(): PannerNode {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      connect(destinationNode: AudioNode, output?: number, input?: number): AudioNode {
        return {} as AudioNode;
      },
    } as PannerNode;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createMediaElementSource(mediaElement: HTMLMediaElement): MediaElementAudioSourceNode {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      connect(destinationNode: AudioNode, output?: number, input?: number): AudioNode {
        return {} as AudioNode;
      },
    } as MediaElementAudioSourceNode;
  }
}
Object.defineProperty(window, "AudioContext", {
  get(): typeof AudioContext {
    return AudioContextMock as unknown as typeof AudioContext;
  },
});

const documentStartTime = Date.now();
const timeline = {};
Object.defineProperty(timeline, "currentTime", {
  get: () => {
    return Date.now() - documentStartTime;
  },
});
(window.document as any).timeline = timeline;
