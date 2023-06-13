import { AudioLoader } from "three";

export const loadAudioBuffer = (function () {
  const audioLoader = new AudioLoader();

  return (url: string) => {
    return new Promise((resolve, reject) => {
      audioLoader.load(
        url,
        (audio: AudioBuffer) => {
          resolve(audio);
        },
        undefined,
        (error: ErrorEvent) => {
          reject(error);
        },
      );
    });
  };
})();
