export class ThreeJSImageLoader {
  static load(
    url: string,
    onLoad: (image: HTMLImageElement) => void,
    onError: (error: ErrorEvent) => void,
    abortSignal: AbortSignal,
  ) {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";

    function onImageLoad() {
      removeEventListeners();
      onLoad(this);
    }

    function onImageError(event: ErrorEvent) {
      removeEventListeners();
      onError(event);
    }

    function removeEventListeners() {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
    }

    abortSignal.addEventListener("abort", () => {
      removeEventListeners();
      image.src = "";
    });

    image.addEventListener("load", onImageLoad, false);
    image.addEventListener("error", onImageError, false);

    image.src = url;

    return image;
  }
}
