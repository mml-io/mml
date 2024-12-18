import { negotiateConnectionWithClientOffer } from "./negotiateConnectionWithClientOffer";
import { VideoSource } from "./VideoSource";

export class WHEPVideoSource implements VideoSource {
  private peerConnection: RTCPeerConnection;
  private stream: MediaStream;

  constructor(
    private srcURL: URL,
    private videoTag: HTMLVideoElement,
  ) {
    const endpoint = new URL(srcURL);
    endpoint.protocol = "https:";
    this.stream = new MediaStream();
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.cloudflare.com:3478",
        },
      ],
      bundlePolicy: "max-bundle",
    });
    this.peerConnection.addTransceiver("video", {
      direction: "recvonly",
    });
    this.peerConnection.addTransceiver("audio", {
      direction: "recvonly",
    });

    this.peerConnection.ontrack = (event) => {
      const track = event.track;
      const currentTracks = this.stream.getTracks();
      const streamAlreadyHasVideoTrack = currentTracks.some((track) => track.kind === "video");
      const streamAlreadyHasAudioTrack = currentTracks.some((track) => track.kind === "audio");
      switch (track.kind) {
        case "video":
          if (streamAlreadyHasVideoTrack) {
            break;
          }
          this.stream.addTrack(track);
          break;
        case "audio":
          if (streamAlreadyHasAudioTrack) {
            break;
          }
          this.stream.addTrack(track);
          break;
        default:
          console.warn("got unknown track " + track);
      }
    };

    this.peerConnection.addEventListener("connectionstatechange", () => {
      if (this.peerConnection.connectionState !== "connected") {
        return;
      }
      this.videoTag.srcObject = this.stream;
    });

    this.peerConnection.addEventListener("negotiationneeded", async () => {
      try {
        await negotiateConnectionWithClientOffer(this.peerConnection, endpoint.toString());
      } catch (err) {
        console.error("Failed to negotiate with WHEP endpoint", err);
      }
    });
  }

  getContentAddress(): string {
    return this.srcURL.toString();
  }

  public dispose() {
    this.peerConnection.close();
    this.videoTag.srcObject = null;
  }

  syncVideoSource() {
    this.videoTag.play().catch((err) => {
      console.error("play error", err);
    });
  }

  static isWHEPURL(url: URL) {
    return url.protocol === "whep:";
  }
}
