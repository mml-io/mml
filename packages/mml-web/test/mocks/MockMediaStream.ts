import { Writeable } from "./types";

export function createMockMediaStream(): Writeable<Partial<MediaStream>> {
  const mockMediaStream = {};
  return mockMediaStream;
}
