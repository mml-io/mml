import { jest } from "@jest/globals";
import EventEmitter from "events";

import { Writeable } from "./types";

export function createMockVideoElement(): Writeable<Partial<HTMLVideoElement>> & {
  eventEmitter: EventEmitter;
} {
  const mockVideoElement = {
    eventEmitter: new EventEmitter(),
    addEventListener: jest.fn().mockImplementation((event: string, callback: any) => {
      mockVideoElement.eventEmitter.on(event, callback);
    }),
    removeEventListener: jest.fn().mockImplementation((event: string, callback: any) => {
      mockVideoElement.eventEmitter.off(event, callback);
    }),
    play: jest.fn().mockImplementation(() => {
      mockVideoElement.paused = false;
      return Promise.resolve();
    }) as () => Promise<void>,
    load: jest.fn(),
    pause: jest.fn().mockImplementation(() => {
      mockVideoElement.paused = true;
      return Promise.resolve();
    }) as () => Promise<void>,
    videoWidth: undefined as number | undefined,
    videoHeight: undefined as number | undefined,
    currentTime: undefined as number | undefined,
    playbackRate: undefined as number | undefined,
    readyState: 0,
    paused: true,
    duration: undefined as number | undefined,
    src: undefined as string | undefined,
    srcObject: null as MediaProvider | null,
  };
  return mockVideoElement;
}
