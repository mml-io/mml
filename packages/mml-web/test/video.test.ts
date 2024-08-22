import { jest } from "@jest/globals";

import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { Video } from "../src/elements/Video";
import { FullScreenMMLScene } from "../src/FullScreenMMLScene";
import { createMockMediaStream } from "./mocks/MockMediaStream";
import { createMockPeerConnection } from "./mocks/MockPeerConnection";
import { createMockVideoElement } from "./mocks/MockVideoElement";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

const originalCreateElement = document.createElement.bind(document);
let createElementSpy: jest.SpiedFunction<any>;
beforeAll(() => {
  registerCustomElementsToWindow(window);
  createElementSpy = jest.spyOn(document, "createElement");
});

jest.useFakeTimers();

describe("m-video", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMMLScene();
    const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
    remoteDocument.init(scene, "ws://localhost:8080");
    document.body.append(remoteDocument);

    const element = document.createElement("m-video") as Video;
    remoteDocument.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0].children[0]).toBe(
      element.getVideoMesh(),
    );

    expect(scene.getThreeScene()).toMatchObject({
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
                  children: expect.arrayContaining([element.getVideoMesh()]),
                },
              ],
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);

    // Setting the width attribute affects the mesh directly
    expect(element.getVideoMesh()!.scale.x).toBe(1);
    element.setAttribute("width", "5");
    expect(element.getVideoMesh()!.scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-video", Video);
    expect(schema.name).toEqual(Video.tagName);
  });

  test("static video file loads", () => {
    const mockVideoElement = createMockVideoElement();
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "video") {
        return mockVideoElement;
      }
      return originalCreateElement(tagName);
    });

    const { element: mVideo, remoteDocument } = createSceneAttachedElement<Video>("m-video");
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

    expect(mVideo.getVideoMesh()!.scale.y).toBe(0.5);
    expect(mVideo.getVideoMesh()!.scale.x).toBe(1);

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

  test("whep video stream loads", () => {
    const mockVideoElement = createMockVideoElement();
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "video") {
        return mockVideoElement;
      }
      return originalCreateElement(tagName);
    });

    const mockMediaStream = createMockMediaStream();
    window.MediaStream = jest.fn().mockImplementation(() => {
      return mockMediaStream;
    }) as unknown as typeof MediaStream;

    const mockPeerConnection = createMockPeerConnection();
    window.RTCPeerConnection = jest
      .fn()
      .mockImplementation(() => mockPeerConnection) as unknown as typeof RTCPeerConnection;

    const { element: mVideo } = createSceneAttachedElement<Video>("m-video");
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

    expect(mockVideoElement.srcObject).toBe((mVideo as any).videoSource.stream);

    // Report that the video has loaded
    mockVideoElement.videoWidth = 200;
    mockVideoElement.videoHeight = 100;
    expect(mockVideoElement.eventEmitter.listeners("loadeddata")).toHaveLength(1);
    mockVideoElement.eventEmitter.emit("loadeddata");

    expect(mVideo.getVideoMesh()!.scale.y).toBe(0.5);
    expect(mVideo.getVideoMesh()!.scale.x).toBe(1);

    mVideo.remove();
    expect(mockPeerConnection.close).toHaveBeenCalled();
  });
});
