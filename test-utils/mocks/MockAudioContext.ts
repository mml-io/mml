export class MockAudioContext {
  addEventListener() {
    return;
  }

  removeEventListener() {
    return;
  }

  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({} as AudioBuffer);
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
      disconnect() {
        return;
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
