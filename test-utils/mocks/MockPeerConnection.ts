import { vi } from "vitest";
import EventEmitter from "events";

import { Writeable } from "./types";

export function createMockPeerConnection(): Writeable<Partial<RTCPeerConnection>> & {
  eventEmitter: EventEmitter;
} {
  const mockPeerConnection = {
    eventEmitter: new EventEmitter(),
    addEventListener: vi.fn().mockImplementation((event: string, callback: any) => {
      mockPeerConnection.eventEmitter.on(event, callback);
    }),
    removeEventListener: vi.fn().mockImplementation((event: string, callback: any) => {
      mockPeerConnection.eventEmitter.off(event, callback);
    }),
    addTransceiver: vi.fn() as (
      trackOrKind: MediaStreamTrack | string,
      init?: RTCRtpTransceiverInit,
    ) => RTCRtpTransceiver,
    close: vi.fn(),
    connectionState: undefined as RTCPeerConnectionState | undefined,
  };
  return mockPeerConnection;
}
