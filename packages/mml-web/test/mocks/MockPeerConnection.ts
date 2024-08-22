import { jest } from "@jest/globals";
import EventEmitter from "events";

import { Writeable } from "./types";

export function createMockPeerConnection(): Writeable<Partial<RTCPeerConnection>> & {
  eventEmitter: EventEmitter;
} {
  const mockPeerConnection = {
    eventEmitter: new EventEmitter(),
    addEventListener: jest.fn().mockImplementation((event: string, callback: any) => {
      mockPeerConnection.eventEmitter.on(event, callback);
    }),
    removeEventListener: jest.fn().mockImplementation((event: string, callback: any) => {
      mockPeerConnection.eventEmitter.off(event, callback);
    }),
    addTransceiver: jest.fn() as (
      trackOrKind: MediaStreamTrack | string,
      init?: RTCRtpTransceiverInit,
    ) => RTCRtpTransceiver,
    close: jest.fn(),
    connectionState: undefined as RTCPeerConnectionState | undefined,
  };
  return mockPeerConnection;
}
