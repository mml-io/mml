





import { Audio, FullScreenMScene, registerCustomElementsToWindow, RemoteDocument } from "../src";









  const scene = new FullScreenMScene();
  const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;












    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(element.getContainer());








    element.setAttribute("src", "http://example.com/some_asset_path");


    expect((element as any).loadedAudioState.audioElement.src).toEqual(
      "http://example.com/some_asset_path",
    );







