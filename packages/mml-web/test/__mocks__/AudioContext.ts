/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/no-empty-function */
import {
  IAudioContext,
  IMediaStreamAudioDestinationNode,
  IMediaStreamAudioSourceNode,
  IPannerNode,
  TChannelCountMode,
  TChannelInterpretation,
} from "standardized-audio-context";
import { AudioContext as AudioContextImpl } from "standardized-audio-context-mock";

/** This mocking of the AudioContext is required because standardized-audio-context-mock
 * fails to provide reasonable implementations of a handful of its methods.
 * */

export default class AudioContext extends AudioContextImpl {
  createPanner(): IPannerNode<IAudioContext> {
    const node: any = {
      pan: <AudioParam>{
        value: 0,
      },
      channelCount: 1,
      channelCountMode: <TChannelCountMode>{},
      channelInterpretation: <TChannelInterpretation>{},
      context: <IAudioContext>{},
      numberOfInputs: 1,
      numberOfOutputs: 1,
      connect: () => {},
      disconnect: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: (): boolean => true,
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    node.pan.setValueAtTime = (pan: number, _time: number) => {
      node.pan.value = pan;
    };

    return node;
  }

  createMediaStreamSource(mediaStream: MediaStream): IMediaStreamAudioSourceNode<this> {
    const s = super.createMediaStreamSource(mediaStream);
    s.connect = () => {};
    return s;
  }

  createMediaStreamDestination(): IMediaStreamAudioDestinationNode<this> {
    return <IMediaStreamAudioDestinationNode<this>>{
      stream: new MediaStream(),
    };
  }
}
