import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";
import { vi } from "vitest";

import { createMockMediaStream } from "../../../test-utils/mocks/MockMediaStream";
import { createMockPeerConnection } from "../../../test-utils/mocks/MockPeerConnection";
import { createMockVideoElement } from "../../../test-utils/mocks/MockVideoElement";
import { registerCustomElementsToWindow } from "../build/index";
import { Video } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

const originalCreateElement = document.createElement.bind(document);
let createElementSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  registerCustomElementsToWindow(window);
  createElementSpy = vi.spyOn(document, "createElement");
});

vi.useFakeTimers();

describe("m-video", () => {
  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Video>("m-video");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const videoMesh = container.children[0 /* element mesh */] as THREE.Mesh;
    expect(videoMesh).toBeDefined();
    expect(element.getContainer()).toBe(container);

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0].children[0],
    ).toBe(videoMesh);

    expect((scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Scene Attachment Container
            {
              children: [
                // Element Container
                {
                  children: expect.arrayContaining([videoMesh]),
                },
              ],
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect((element.getContainer() as THREE.Object3D).scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect((element.getContainer() as THREE.Object3D).scale.x).toBe(5);

    // Setting the width attribute - should affect the mesh
    expect(videoMesh.scale.x).toBe(1);
    element.setAttribute("width", "5");
    expect(videoMesh.scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-video", Video);
    expect(schema.name).toEqual(Video.tagName);
  });

  test("static video file loads", async () => {
    const mockVideoElement = createMockVideoElement();
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "video") {
        return mockVideoElement;
      }
      return originalCreateElement(tagName);
    });

    const { element: mVideo, remoteDocument } = await createSceneAttachedElement<Video>("m-video");
    // The internal video element should have been created
    expect(createElementSpy).toHaveBeenCalled();

    remoteDocument.getDocumentTimeManager().overrideDocumentTime(0);

    // Set the m-video source and check if the internal video element's src was set
    mVideo.setAttribute("src", "https://example.com/video.mp4");
    expect(mockVideoElement.src).toEqual("https://example.com/video.mp4");

    expect(mockVideoElement.play).toHaveBeenCalledTimes(0);
    // Report that the video has loaded
    mockVideoElement.videoWidth = 200;
    mockVideoElement.videoHeight = 100;
    mockVideoElement.duration = 10000;
    mockVideoElement.currentTime = 0;
    mockVideoElement.playbackRate = 1;
    mockVideoElement.readyState = 2;
    expect(mockVideoElement.eventEmitter.listeners("loadeddata")).toHaveLength(1);
    mockVideoElement.eventEmitter.emit("loadeddata");
    expect(mockVideoElement.play).toHaveBeenCalledTimes(1);

    const videoMesh = (mVideo.getContainer() as THREE.Object3D).children[0];
    expect(videoMesh.scale.y).toBe(0.5);
    expect(videoMesh.scale.x).toBe(1);

    remoteDocument.getDocumentTimeManager().overrideDocumentTime(2500);
    expect(mockVideoElement.currentTime).toEqual(2.5);

    // Check that the video is paused (and set to the correct time / frame) when the start-time is set to in the future
    expect(mockVideoElement.pause).toHaveBeenCalledTimes(0);
    mVideo.setAttribute("start-time", "3000");
    expect(mockVideoElement.pause).toHaveBeenCalledTimes(1);
    expect(mockVideoElement.currentTime).toEqual(0);

    // Check that the video resumes when the start-time is passed
    expect(mockVideoElement.play).toHaveBeenCalledTimes(1);
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(4500);
    expect(mockVideoElement.currentTime).toEqual(1.5);
    expect(mockVideoElement.playbackRate).toEqual(1);
    expect(mockVideoElement.play).toHaveBeenCalledTimes(2);

    /*
     Check that when the currentTime is > 0.1 and < 0.5 where the playback should be based on the documentTime the
     playback rate is adjusted to slowly correct.
    */
    expect(mockVideoElement.playbackRate).toEqual(1);
    mockVideoElement.currentTime = 1.75;
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(5000);
    expect(mockVideoElement.currentTime).toEqual(1.75);
    expect(mockVideoElement.playbackRate).toEqual(1.02);

    /*
     Check that significant (>0.5) differences between the currentTime and the desired playback position calculated
     from documentTime are addressed by setting the playback rate to 1 and setting the currentTime to the desired
    */
    mockVideoElement.currentTime = 2;
    // The desired position in the video at 6000 (starting at 3000) should be 3
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(6000);
    expect(mockVideoElement.currentTime).toEqual(3);
    expect(mockVideoElement.playbackRate).toEqual(1);

    // Setting the pause-time in the future does not affect playback
    expect(mockVideoElement.pause).toHaveBeenCalledTimes(1);
    mVideo.setAttribute("pause-time", "7000");
    expect(mockVideoElement.pause).toHaveBeenCalledTimes(1);

    // Reaching the pause time pauses the video and sets it to the paused frame
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(7500);
    expect(mockVideoElement.pause).toHaveBeenCalledTimes(2);
    expect(mockVideoElement.currentTime).toEqual(4);

    mVideo.remove();
  });

  test("whep video stream loads", async () => {
    const mockVideoElement = createMockVideoElement();
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "video") {
        return mockVideoElement;
      }
      return originalCreateElement(tagName);
    });

    const mockMediaStream = createMockMediaStream();
    window.MediaStream = vi.fn().mockImplementation(function () {
      return mockMediaStream;
    }) as unknown as typeof MediaStream;

    const mockPeerConnection = createMockPeerConnection();
    window.RTCPeerConnection = vi.fn().mockImplementation(function () {
      return mockPeerConnection;
    }) as unknown as typeof RTCPeerConnection;

    const { element: mVideo } = await createSceneAttachedElement<Video>("m-video");
    // The internal video element should have been created
    expect(createElementSpy).toHaveBeenCalled();

    // Set the m-video source and check if the internal video element's srcObject was set to the MediaStream
    mVideo.setAttribute("src", "whep://example.com/myStream");

    expect(mockPeerConnection.addTransceiver).toHaveBeenCalled();
    expect(mockPeerConnection.addEventListener).toHaveBeenCalledWith(
      "connectionstatechange",
      expect.any(Function),
    );

    mockPeerConnection.connectionState = "connected";
    mockPeerConnection.eventEmitter.emit("connectionstatechange");

    expect(mockVideoElement.srcObject).toBe((mVideo as any).videoGraphics.videoSource.stream);

    // Report that the video has loaded
    mockVideoElement.videoWidth = 200;
    mockVideoElement.videoHeight = 100;
    expect(mockVideoElement.eventEmitter.listeners("loadeddata")).toHaveLength(1);
    mockVideoElement.eventEmitter.emit("loadeddata");

    const videoMesh = (mVideo.getContainer() as THREE.Object3D).children[0];
    expect(videoMesh.scale.y).toBe(0.5);
    expect(videoMesh.scale.x).toBe(1);

    mVideo.remove();
    expect(mockPeerConnection.close).toHaveBeenCalled();
  });
});
